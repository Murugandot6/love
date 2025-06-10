// Paste your Firebase configuration object here
const firebaseConfig = {
  apiKey: "AIzaSyA8QfLoifA2-DjldYaMBeIge1D6TbRpBWw",
  authDomain: "summa-57ad5.firebaseapp.com",
  projectId: "summa-57ad5",
  storageBucket: "summa-57ad5.appspot.com", // Make sure this is correct for Storage
  messagingSenderId: "472212537134",
  appId: "1:472212537134:web:fc930ea95fa9b7ffc4c4bf"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage(); // Initialize Firebase Storage

// --- PAGE LOAD ROUTING ---
document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(user => {
        const page = window.location.pathname.split("/").pop();
        const protectedPages = ["dashboard.html", "grievance.html", "profile.html"];
        
        if (user) { // User is logged in
            if (page === 'login.html' || page === 'register.html' || page === 'index.html' || page === '') {
                window.location.href = 'dashboard.html';
            } else if (protectedPages.includes(page)) {
                // Load page-specific logic for logged-in users
                if (page === 'dashboard.html') loadDashboard();
                if (page === 'profile.html') loadProfilePage();
                if (page === 'grievance.html') initGrievanceForm();
            }
        } else { // User is not logged in
            if (protectedPages.includes(page)) {
                window.location.href = 'login.html';
            }
        }
    });

    // Init forms that are on public pages
    const page = window.location.pathname.split("/").pop();
    if (page === 'register.html') initRegisterForm();
    if (page === 'login.html') initLoginForm();
    
    // Universal logout listener
    document.body.addEventListener('click', (e) => {
        if (e.target.matches('#logout')) {
            e.preventDefault();
            auth.signOut().then(() => window.location.href = 'login.html');
        }
    });
});


// --- AUTHENTICATION ---
const initRegisterForm = () => {
    const form = document.getElementById('registerForm');
    form.addEventListener('submit', e => {
        e.preventDefault();
        const nickname = form.nickname.value;
        const email = form.email.value;
        const password = form.password.value;
        const partnerEmail = form.partnerEmail.value.toLowerCase();

        auth.createUserWithEmailAndPassword(email, password)
            .then(cred => {
                // Create user profile in Firestore
                return db.collection('users').doc(cred.user.uid).set({
                    email: email,
                    nickname: nickname,
                    partnerEmail: partnerEmail,
                    profilePicUrl: null // Initialize with no picture
                });
            })
            .then(() => {
                alert('Registration successful!');
                window.location.href = 'login.html';
            })
            .catch(err => alert(err.message));
    });
};

const initLoginForm = () => {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', e => {
        e.preventDefault();
        const email = form.username.value;
        const password = form.password.value;
        auth.signInWithEmailAndPassword(email, password)
            .then(() => window.location.href = 'dashboard.html')
            .catch(err => alert(err.message));
    });
};

// --- PROFILE MANAGEMENT ---
const loadProfilePage = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();

    // Populate form with existing data
    document.getElementById('nickname').value = userData.nickname || '';
    document.getElementById('partnerEmail').value = userData.partnerEmail || '';
    if (userData.profilePicUrl) {
        document.getElementById('profilePicPreview').src = userData.profilePicUrl;
    }
    
    initProfileForm();
};

const initProfileForm = () => {
    const form = document.getElementById('profileForm');
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const user = auth.currentUser;
        const file = document.getElementById('profilePicUpload').files[0];
        const nickname = document.getElementById('nickname').value;
        const partnerEmail = document.getElementById('partnerEmail').value.toLowerCase();
        let profilePicUrl = document.getElementById('profilePicPreview').src;

        // 1. If a new file is uploaded, handle the upload
        if (file) {
            const storageRef = storage.ref(`profile_pictures/${user.uid}/${file.name}`);
            const snapshot = await storageRef.put(file);
            profilePicUrl = await snapshot.ref.getDownloadURL();
        }

        // 2. Update the user's document in Firestore
        await db.collection('users').doc(user.uid).update({
            nickname: nickname,
            partnerEmail: partnerEmail,
            profilePicUrl: profilePicUrl
        });

        alert('Profile updated successfully!');
        window.location.href = 'dashboard.html';
    });
    
    // Preview image on file select
    document.getElementById('profilePicUpload').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('profilePicPreview').src = event.target.result;
            }
            reader.readAsDataURL(file);
        }
    });
};

// --- GRIEVANCE SUBMISSION (BUG FIXED) ---
const initGrievanceForm = () => {
    document.getElementById('grievanceForm').addEventListener('submit', async e => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            alert("Error: Your user profile is missing.");
            return;
        }
        const partnerEmail = userDoc.data().partnerEmail;
        if (!partnerEmail) {
            alert("Please set your partner's email in your profile before submitting a grievance.");
            window.location.href = 'profile.html';
            return;
        }
        
        // **BUG FIX LOGIC:** We no longer require the partner to be registered.
        // We find their ID if they exist, but proceed even if they don't.
        const partnerQuery = await db.collection('users').where('email', '==', partnerEmail).get();
        const partnerId = partnerQuery.empty ? null : partnerQuery.docs[0].id;

        db.collection('grievances').add({
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            mood: document.getElementById('mood').value,
            severity: document.getElementById('severity').value,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            senderId: user.uid,
            senderEmail: user.email,
            receiverId: partnerId, // This can be null if partner hasn't registered
            receiverEmail: partnerEmail,
            status: 'Pending'
        }).then(() => {
            window.location.href = 'thankyou.html'; // Redirect to a confirmation page
        }).catch(error => alert(error.message));
    });
};


// --- DASHBOARD DISPLAY ---
const loadDashboard = async () => {
    const user = auth.currentUser;
    if (!user) return;

    // Load user and partner data for the "Couple's Corner"
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    document.getElementById('welcome-user').innerText = `Welcome, ${userData.nickname || user.email}!`;
    
    // Display user's own profile
    const userProfile = document.getElementById('user-profile');
    userProfile.querySelector('img').src = userData.profilePicUrl || 'https://via.placeholder.com/100';
    userProfile.querySelector('p').textContent = userData.nickname || 'You';
    
    // Display partner's profile
    if (userData.partnerEmail) {
        const partnerQuery = await db.collection('users').where('email', '==', userData.partnerEmail).get();
        const partnerProfile = document.getElementById('partner-profile');
        if (!partnerQuery.empty) {
            const partnerData = partnerQuery.docs[0].data();
            partnerProfile.querySelector('img').src = partnerData.profilePicUrl || 'https://via.placeholder.com/100';
            partnerProfile.querySelector('p').textContent = partnerData.nickname || 'Partner';
        } else {
             partnerProfile.querySelector('p').textContent = '(Partner not registered)';
        }
    }

    // Load sent and received grievances (real-time with onSnapshot)
    loadGrievances(user.uid, 'sent');
    loadGrievances(user.uid, 'received');
};

const loadGrievances = (uid, type) => {
    const listEl = document.getElementById(`${type}-grievances-list`);
    const queryField = type === 'sent' ? 'senderId' : 'receiverId';

    db.collection('grievances').where(queryField, "==", uid).orderBy("timestamp", "desc")
        .onSnapshot(snapshot => {
            if (snapshot.empty) {
                listEl.innerHTML = `<p>${type === 'sent' ? 'No grievances sent yet.' : 'Hooray! No grievances received.'}</p>`;
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const g = doc.data();
                html += `
                    <div class="grievance-item">
                        <h4>${g.title}</h4>
                        <p>${g.description}</p>
                        <div class="meta">
                            <span>From: ${g.senderEmail}</span><br>
                            <span>To: ${g.receiverEmail}</span>
                        </div>
                        <div class="grievance-status">Status: ${g.status}</div>
                        ${type === 'received' ? getStatusUpdateForm(doc.id, g.status) : ''}
                    </div>`;
            });
            listEl.innerHTML = html;
        });
};

const getStatusUpdateForm = (docId, currentStatus) => {
    return `
    <form class="status-update-form" data-id="${docId}" onsubmit="updateGrievanceStatus(event)">
        <select name="status">
            <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
            <option value="Working on it" ${currentStatus === 'Working on it' ? 'selected' : ''}>🛠️ Working on it</option>
            <option value="Resolved" ${currentStatus === 'Resolved' ? 'selected' : ''}>✅ Resolved</option>
        </select>
        <button type="submit">Update</button>
    </form>`;
};

// Function to handle status update, needs to be in global scope to be called by onsubmit
function updateGrievanceStatus(event) {
    event.preventDefault();
    const form = event.target;
    const docId = form.dataset.id;
    const newStatus = form.status.value;
    db.collection('grievances').doc(docId).update({ status: newStatus });
}

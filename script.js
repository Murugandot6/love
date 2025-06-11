// --- STEP 1: PASTE YOUR NEW, SECURE FIREBASE CONFIGURATION HERE ---
// WARNING: Your old API key was exposed. Please generate a new one from 
// the Firebase console and replace the placeholder values below.
const firebaseConfig = {
  apiKey: "AIzaSyA8QfLoifA2-DjldYaMBeIge1D6TbRpBWw", // This is a secret key
  authDomain: "summa-57ad5.firebaseapp.com",
  projectId: "summa-57ad5",
  storageBucket: "summa-57ad5.appspot.com",
  messagingSenderId: "472212537134",
  appId: "1:472212537134:web:fc930ea95fa9b7ffc4c4bf"
};

// --- INITIALIZE FIREBASE SERVICES ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- NEW: AVATAR GENERATION FUNCTION ---
// This function creates a unique avatar URL from DiceBear based on a seed string.
const generateAvatarUrl = (seed) => {
    // You can change 'micah' to other styles like 'bottts', 'adventurer', 'fun-emoji', etc.
    // See DiceBear documentation for more styles.
    const style = 'micah';
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
};

// --- PAGE LOAD ROUTING ---
document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(user => {
        const page = window.location.pathname.split("/").pop();
        const protectedPages = ["dashboard.html", "grievance.html", "profile.html"];
        
        if (user) {
            if (page === 'login.html' || page === 'register.html' || page === 'index.html' || page === '') {
                window.location.href = 'dashboard.html';
            } else if (protectedPages.includes(page)) {
                if (page === 'dashboard.html') loadDashboard();
                if (page === 'profile.html') loadProfilePage();
            }
        } else {
            if (protectedPages.includes(page)) {
                window.location.href = 'login.html';
            }
        }
    });

    const page = window.location.pathname.split("/").pop();
    if (page === 'register.html' && document.getElementById('registerForm')) initRegisterForm();
    if (page === 'login.html' && document.getElementById('loginForm')) initLoginForm();
    if (page === 'profile.html' && document.getElementById('profileForm')) initProfileForm();
    if (page === 'grievance.html' && document.getElementById('grievanceForm')) initGrievanceForm();
    
    document.body.addEventListener('click', e => {
        if (e.target.matches('#logout, #logout *')) {
            e.preventDefault();
            auth.signOut().then(() => window.location.href = 'login.html');
        }
    });
});

// --- AUTHENTICATION (MODIFIED FOR AVATARS) ---
const initRegisterForm = () => {
    const form = document.getElementById('registerForm');
    form.addEventListener('submit', e => {
        e.preventDefault();
        const nickname = form.nickname.value;
        const email = form.email.value;
        const password = form.password.value;
        const partnerEmail = form.partnerEmail.value.toLowerCase();
        
        // --- MODIFIED: Generate an avatar URL on registration ---
        const avatarUrl = generateAvatarUrl(nickname);

        auth.createUserWithEmailAndPassword(email, password)
            .then(cred => db.collection('users').doc(cred.user.uid).set({
                email: email,
                nickname: nickname,
                partnerEmail: partnerEmail,
                profilePicUrl: avatarUrl // --- MODIFIED: Save the new avatar URL ---
            }))
            .then(() => {
                alert('Registration successful! Please log in.');
                window.location.href = 'login.html';
            })
            .catch(err => alert(`Error: ${err.message}`));
    });
};

const initLoginForm = () => {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', e => {
        e.preventDefault();
        const email = form.email.value; 
        const password = form.password.value;
        auth.signInWithEmailAndPassword(email, password)
            .then(() => window.location.href = 'dashboard.html')
            .catch(err => alert(`Login Failed: ${err.message}`));
    });
};

// --- PROFILE MANAGEMENT (MODIFIED FOR AVATARS) ---
const loadProfilePage = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) return;
    const userData = userDoc.data();

    document.getElementById('nickname').value = userData.nickname || '';
    document.getElementById('partnerEmail').value = userData.partnerEmail || '';
    
    // --- MODIFIED: Use DiceBear avatar as a fallback ---
    document.getElementById('profilePicPreview').src = userData.profilePicUrl || generateAvatarUrl(userData.nickname || 'user');
    
    // Hide the file upload button as it's not used
    document.querySelector('.btn-upload').style.display = 'none';
};

const initProfileForm = () => {
    document.getElementById('profileForm').addEventListener('submit', async e => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;
        
        const nickname = document.getElementById('nickname').value;
        const partnerEmail = document.getElementById('partnerEmail').value.toLowerCase();
        
        // --- MODIFIED: Generate a new avatar URL when the nickname changes ---
        const newAvatarUrl = generateAvatarUrl(nickname);

        await db.collection('users').doc(user.uid).update({
            nickname: nickname,
            partnerEmail: partnerEmail,
            profilePicUrl: newAvatarUrl // --- MODIFIED: Update the avatar URL ---
        });

        alert('Profile updated successfully!');
        window.location.href = 'dashboard.html';
    });
};


// --- GRIEVANCE SUBMISSION (NO CHANGES) ---
const initGrievanceForm = () => {
    document.getElementById('grievanceForm').addEventListener('submit', async e => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        const partnerEmail = userDoc.data().partnerEmail;
        
        if (!partnerEmail) {
            alert("Please set your partner's email in your profile first!");
            window.location.href = 'profile.html';
            return;
        }
        
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
            receiverId: partnerId,
            receiverEmail: partnerEmail,
            status: 'Pending'
        }).then(() => {
            window.location.href = 'thankyou.html';
        }).catch(error => alert(error.message));
    });
};

// --- DASHBOARD (MODIFIED FOR AVATARS) ---
const loadDashboard = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) { console.error("User doc not found!"); return; }
    const userData = userDoc.data();
    
    document.getElementById('welcome-user').innerText = `Welcome, ${userData.nickname || user.email}!`;
    
    const userProfileEl = document.getElementById('user-profile');
    // --- MODIFIED: Use DiceBear avatar as a fallback ---
    userProfileEl.querySelector('img').src = userData.profilePicUrl || generateAvatarUrl(userData.nickname || 'user');
    userProfileEl.querySelector('p').textContent = userData.nickname || 'You';
    
    if (userData.partnerEmail) {
        const partnerQuery = await db.collection('users').where('email', '==', userData.partnerEmail).get();
        const partnerProfileEl = document.getElementById('partner-profile');
        if (!partnerQuery.empty) {
            const partnerData = partnerQuery.docs[0].data();
            // --- MODIFIED: Use DiceBear avatar for partner ---
            partnerProfileEl.querySelector('img').src = partnerData.profilePicUrl || generateAvatarUrl(partnerData.nickname || 'partner');
            partnerProfileEl.querySelector('p').textContent = partnerData.nickname || 'Partner';
        } else {
             partnerProfileEl.querySelector('img').src = generateAvatarUrl('partner');
             partnerProfileEl.querySelector('p').textContent = 'Partner';
        }
    }

    loadGrievances(user.uid, 'sent');
    loadGrievances(user.email, 'received');

    const receivedList = document.getElementById('received-grievances-list');
    if(receivedList) {
        receivedList.addEventListener('submit', e => {
            e.preventDefault();
            if (e.target.matches('.status-update-form')) {
                const form = e.target;
                db.collection('grievances').doc(form.dataset.id).update({ status: form.status.value });
            }
        });
    }
};

const loadGrievances = (identifier, type) => {
    const listEl = document.getElementById(`${type}-grievances-list`);
    if(!listEl) return;
    const queryField = type === 'sent' ? 'senderId' : 'receiverEmail';

    db.collection('grievances').where(queryField, "==", identifier).orderBy("timestamp", "desc")
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
                            <span>Mood: ${g.mood} | Severity: ${g.severity}</span><br>
                            <span>Sent on: ${g.timestamp ? g.timestamp.toDate().toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div class="grievance-status">Status: ${g.status}</div>
                        ${type === 'received' ? getStatusUpdateForm(doc.id, g.status) : ''}
                    </div>`;
            });
            listEl.innerHTML = html;
        });
};

const getStatusUpdateForm = (docId, currentStatus) => `
    <form class="status-update-form" data-id="${docId}">
        <select name="status">
            <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
            <option value="Working on it" ${currentStatus === 'Working on it' ? 'selected' : ''}>🛠️ Working on it</option>
            <option value="Resolved" ${currentStatus === 'Resolved' ? 'selected' : ''}>✅ Resolved</option>
        </select>
        <button type="submit">Update</button>
    </form>`;

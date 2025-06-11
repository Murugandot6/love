// --- Your Firebase Configuration ---
// This uses the exact keys you provided.
const firebaseConfig = {
    apiKey: "AIzaSyA8QfLoifA2-DjldYaMBeIge1D6TbRpBWw",
    authDomain: "summa-57ad5.firebaseapp.com",
    projectId: "summa-57ad5",
    storageBucket: "summa-57ad5.firebasestorage.app",
    messagingSenderId: "472212537134",
    appId: "1:472212537134:web:fc930ea95fa9b7ffc4c4bf"
};

// --- INITIALIZE FIREBASE SERVICES ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- HEART EMOJI ASSIGNMENT LOGIC ---
const heartEmojis = ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎'];
const assignUserIcon = (uid) => {
    const charCodeSum = uid.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const index = charCodeSum % heartEmojis.length;
    return heartEmojis[index];
};

// --- PAGE LOAD ROUTING ---
document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(user => {
        const page = window.location.pathname.split("/").pop();
        const isProtected = ["dashboard.html", "grievance.html", "profile.html"].includes(page);
        
        if (user) {
            const isAuthPage = ["login.html", "register.html", "index.html", ""].includes(page);
            if (isAuthPage) {
                window.location.href = 'dashboard.html';
            } else if (isProtected) {
                if (page === 'dashboard.html') loadDashboard();
                if (page === 'profile.html') loadProfilePage();
                if (page === 'grievance.html') initGrievanceForm();
            }
        } else {
            if (isProtected) {
                window.location.href = 'login.html';
            }
        }
    });

    const page = window.location.pathname.split("/").pop();
    if (page === 'register.html') initRegisterForm();
    if (page === 'login.html') initLoginForm();
    
    document.body.addEventListener('click', e => {
        if (e.target.closest('#logout')) {
            e.preventDefault();
            auth.signOut().then(() => window.location.href = 'login.html');
        }
    });
});

// --- AUTHENTICATION (TEST VERSION) ---
const initRegisterForm = () => {
    const form = document.getElementById('registerForm');
    if (!form) return;
    form.addEventListener('submit', e => {
        e.preventDefault();
        const nickname = form.nickname.value;
        const email = form.email.value;
        const password = form.password.value;
        const partnerEmail = form.partnerEmail.value.toLowerCase();

        console.log("REGISTER TEST: Starting registration process...");

        auth.createUserWithEmailAndPassword(email, password)
            .then(cred => {
                console.log("REGISTER TEST: Authentication user created. Now creating Firestore document...");
                const userIcon = assignUserIcon(cred.user.uid);
                // This is the step that was failing
                return db.collection('users').doc(cred.user.uid).set({
                    email: email,
                    nickname: nickname,
                    partnerEmail: partnerEmail,
                    userIcon: userIcon
                });
            })
            .then(() => {
                // --- THIS IS THE PROOF ---
                // If you see this message, the NEW code is working.
                console.log("REGISTER TEST: Firestore document created successfully.");
                alert('SUCCESS! The NEW registration code is working! Welcome!');
                window.location.href = 'dashboard.html';
            })
            .catch(err => {
                // This will now catch any error, including Firestore permission errors.
                console.error("A CRITICAL REGISTRATION ERROR OCCURRED:", err);
                alert(`Registration Failed: ${err.message}`);
            });
    });
};

const initLoginForm = () => {
    // ... your existing login form code is fine, leave it as is ...
    const form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', e => {
        e.preventDefault();
        const email = form.email.value; 
        const password = form.password.value;
        auth.signInWithEmailAndPassword(email, password)
            .then(() => window.location.href = 'dashboard.html')
            .catch(err => {
                console.error("Login Failed:", err);
                alert(`Login Failed: ${err.message}`);
            });
    });
};
// --- PROFILE PAGE ---
const loadProfilePage = () => {
    const user = auth.currentUser;
    if (!user) return;

    // --- FIX 2: Attach the form listener IMMEDIATELY. ---
    // This guarantees the "Save" button will always work, even for new users.
    initProfileForm(user); 

    // Now, just try to load existing data to fill the form.
    db.collection('users').doc(user.uid).get().then(doc => {
        if (doc.exists) {
            const userData = doc.data();
            document.getElementById('nickname').value = userData.nickname || '';
            document.getElementById('partnerEmail').value = userData.partnerEmail || '';
            document.getElementById('profile-icon-preview').textContent = userData.userIcon || '❤️';
        } else {
            console.warn("User document doesn't exist yet. It will be created on first save.");
            document.getElementById('profile-icon-preview').textContent = assignUserIcon(user.uid);
        }
    }).catch(error => {
        console.error("Error loading profile data:", error);
    });
};

const initProfileForm = (user) => {
    const form = document.getElementById('profileForm');
    if (!form) return;
    form.addEventListener('submit', async e => {
        e.preventDefault();
        
        const nickname = document.getElementById('nickname').value;
        const partnerEmail = document.getElementById('partnerEmail').value.toLowerCase();
        
        try {
            // --- FIX 3: Use .set({ merge: true }) instead of .update() ---
            // This will CREATE the document if it's new, or UPDATE it if it exists.
            await db.collection('users').doc(user.uid).set({ nickname, partnerEmail }, { merge: true });
            
            alert('Profile updated successfully!');
            window.location.href = 'dashboard.html';
        } catch (error) {
            console.error("Profile Update Error:", error);
            alert(`Failed to update profile: ${error.message}`);
        }
    });
};


// --- GRIEVANCE SUBMISSION ---
const initGrievanceForm = () => {
    const form = document.getElementById('grievanceForm');
    if (!form) return;
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="iconoir-clock"></i> Submitting...';

        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            // --- FIX 4: MORE ROBUST CHECK ---
            // Ensure the partner's email is not empty.
            if (!userDoc.exists() || !userDoc.data().partnerEmail || userDoc.data().partnerEmail.trim() === '') {
                alert("Please set your partner's email in your profile before submitting a grievance!");
                window.location.href = 'profile.html';
                return; // Stop execution here
            }
            
            const userData = userDoc.data();
            const partnerEmail = userData.partnerEmail;
            const partnerQuery = await db.collection('users').where('email', '==', partnerEmail).get();
            const partnerId = partnerQuery.empty ? null : partnerQuery.docs[0].id;

            await db.collection('grievances').add({
                title: form.title.value,
                description: form.description.value,
                mood: form.mood.value,
                severity: form.severity.value,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                senderId: user.uid,
                senderNickname: userData.nickname,
                receiverId: partnerId,
                receiverEmail: partnerEmail,
                status: 'Pending'
            });
            window.location.href = 'thankyou.html';
        } catch (error) {
            console.error("Grievance Submission Error:", error);
            alert(`Failed to send grievance: ${error.message}`);
            // Re-enable the button on failure
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="iconoir-send"></i> Submit 💌';
        }
    });
};


// --- DASHBOARD --- (No changes needed here, left for completeness)
const loadDashboard = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            alert("Your profile data is missing. Please log out and register again.");
            auth.signOut();
            return;
        }
        
        const userData = userDoc.data();
        document.getElementById('welcome-user').innerText = `Welcome, ${userData.nickname || user.email}!`;
        document.getElementById('user-icon').textContent = userData.userIcon || '❤️';
        document.querySelector('#user-profile p').textContent = userData.nickname || 'You';
        
        if (userData.partnerEmail) {
            const partnerQuery = await db.collection('users').where('email', '==', userData.partnerEmail).get();
            const partnerIconEl = document.getElementById('partner-icon');
            const partnerNameEl = document.querySelector('#partner-profile p');
            if (!partnerQuery.empty) {
                const partnerData = partnerQuery.docs[0].data();
                partnerIconEl.textContent = partnerData.userIcon || '💜';
                partnerNameEl.textContent = partnerData.nickname || 'Partner';
            } else {
                partnerIconEl.textContent = '❔';
                partnerNameEl.textContent = 'Partner (Unregistered)';
            }
        }

        loadGrievances(user.uid, 'sent');
        loadGrievances(user.email, 'received');

        const receivedList = document.getElementById('received-grievances-list');
        if (receivedList) {
            receivedList.addEventListener('submit', e => {
                e.preventDefault();
                if (e.target.matches('.status-update-form')) {
                    const form = e.target;
                    db.collection('grievances').doc(form.dataset.id).update({ status: form.status.value });
                }
            });
        }
    } catch (error) {
        console.error("Error loading dashboard:", error);
        alert(`An error occurred: ${error.message}`);
    }
};

const loadGrievances = (identifier, type) => {
    const listEl = document.getElementById(`${type}-grievances-list`);
    if (!listEl) return;
    const queryField = type === 'sent' ? 'senderId' : 'receiverEmail';

    db.collection('grievances').where(queryField, "==", identifier).orderBy("timestamp", "desc")
        .onSnapshot(snapshot => {
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
            listEl.innerHTML = html || `<p>${type === 'sent' ? 'No grievances sent yet.' : 'Hooray! No grievances received.'}</p>`;
        }, error => {
            console.error(`Error loading ${type} grievances:`, error);
            listEl.innerHTML = `<p style="color: red;">Error: Could not load grievances. Check permissions.</p>`;
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

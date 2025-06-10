// Paste your Firebase configuration object here
const firebaseConfig = {
  apiKey: "AIzaSyA8QfLoifA2-DjldYaMBeIge1D6TbRpBWw",
  authDomain: "summa-57ad5.firebaseapp.com",
  projectId: "summa-57ad5",
  storageBucket: "summa-57ad5.firebasestorage.app",
  messagingSenderId: "472212537134",
  appId: "1:472212537134:web:fc930ea95fa9b7ffc4c4bf"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- HELPER FUNCTIONS ---
const showProtectedPage = (user, page) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        if (page === 'dashboard.html') loadDashboard();
        if (page === 'thankyou.html') document.getElementById('thank-you-name').textContent = `Thank you, ${user.email}! 💖`;
        if (page === 'grievance.html') {
             const logoutLink = document.querySelector('#logout');
             if(logoutLink) {
                 logoutLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    auth.signOut();
                });
             }
        }
    }
};

const showAuthPage = (user) => {
    if (user) {
        window.location.href = 'dashboard.html';
    }
};

// --- AUTH STATE MANAGEMENT ---
document.addEventListener("DOMContentLoaded", () => {
    const page = window.location.pathname.split("/").pop();
    const protectedPages = ["grievance.html", "dashboard.html", "thankyou.html"];
    const authPages = ['login.html', 'register.html', 'index.html', ''];

    auth.onAuthStateChanged(user => {
        if (protectedPages.includes(page)) {
            showProtectedPage(user, page);
        } else if (authPages.includes(page)) {
            showAuthPage(user);
        }
    });

    // Event Listeners are initialized here based on the current page
    if (page === 'register.html') initRegisterForm();
    if (page === 'login.html') initLoginForm();

    // Universal logout listener
    const logoutLinks = document.querySelectorAll('#logout');
    logoutLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => {
                window.location.href = 'login.html';
            });
        });
    });
});


// --- AUTHENTICATION LOGIC ---
const initRegisterForm = () => {
    const registerForm = document.getElementById('registerForm');
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const partnerEmail = document.getElementById('partnerEmail').value.toLowerCase();

        if (email.toLowerCase() === partnerEmail) {
            alert("You cannot be your own partner! That's a different kind of portal.");
            return;
        }

        auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                // Create a user profile in Firestore
                db.collection('users').doc(userCredential.user.uid).set({
                    email: userCredential.user.email,
                    partnerEmail: partnerEmail
                }).then(() => {
                    alert('Registration successful! Please log in.');
                    window.location.href = 'login.html';
                });
            })
            .catch(error => alert(error.message));
    });
};

const initLoginForm = () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            auth.signInWithEmailAndPassword(email, password)
                .then(() => window.location.href = 'dashboard.html')
                .catch(error => alert(error.message));
        });
    }
};

// --- GRIEVANCE HANDLING ---
const initGrievanceForm = () => {
    const grievanceForm = document.getElementById('grievanceForm');
    grievanceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        // 1. Get sender's data to find partner's email
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            alert("Your user profile is not set up correctly.");
            return;
        }
        const partnerEmail = userDoc.data().partnerEmail;

        // 2. Find partner's user account to get their UID
        const partnerQuery = await db.collection('users').where('email', '==', partnerEmail).get();
        if (partnerQuery.empty) {
            alert(`Your partner (${partnerEmail}) has not registered yet!`);
            return;
        }
        const partnerId = partnerQuery.docs[0].id;

        // 3. Add the new grievance with sender and receiver IDs
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
            status: 'Pending' // Initial status
        }).then(() => {
            window.location.href = 'thankyou.html';
        }).catch(error => alert(error.message));
    });
};


// --- DASHBOARD LOGIC ---
const loadDashboard = async () => {
    const user = auth.currentUser;
    if (!user) return;

    document.getElementById('welcome-user').innerText = `Welcome, ${user.email}!`;
    const sentList = document.getElementById('sent-grievances-list');
    const receivedList = document.getElementById('received-grievances-list');

    // Partner Status Check
    const userDoc = await db.collection('users').doc(user.uid).get();
    const partnerEmail = userDoc.data().partnerEmail;
    const partnerQuery = await db.collection('users').where('email', '==', partnerEmail).get();
    if(partnerQuery.empty) {
         document.getElementById('partner-status').innerText = `Your partner (${partnerEmail}) hasn't registered yet.`;
    } else {
         document.getElementById('partner-status').innerText = `Your partner is ${partnerEmail}.`;
    }

    // Load Sent Grievances
    db.collection('grievances').where("senderId", "==", user.uid).orderBy("timestamp", "desc").onSnapshot(snapshot => {
        if (snapshot.empty) {
            sentList.innerHTML = '<p>You have not submitted any grievances yet.</p>';
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
                        <span>To: ${g.receiverEmail} on ${g.timestamp ? g.timestamp.toDate().toLocaleDateString() : '...'}</span>
                    </div>
                    <div class="grievance-status">Status: ${g.status}</div>
                </div>`;
        });
        sentList.innerHTML = html;
    });

    // Load Received Grievances
    db.collection('grievances').where("receiverId", "==", user.uid).orderBy("timestamp", "desc").onSnapshot(snapshot => {
        if (snapshot.empty) {
            receivedList.innerHTML = '<p>Hooray! No grievances received.</p>';
            return;
        }
        let html = '';
        snapshot.forEach(doc => {
            const g = doc.data();
            const grievanceId = doc.id;
            html += `
                <div class="grievance-item">
                    <h4>${g.title}</h4>
                    <p>${g.description}</p>
                    <div class="meta">
                        <span>Mood: ${g.mood} | Severity: ${g.severity}</span><br>
                        <span>From: ${g.senderEmail} on ${g.timestamp ? g.timestamp.toDate().toLocaleDateString() : '...'}</span>
                    </div>
                     <div class="grievance-status">Status: ${g.status}</div>
                    <form class="status-update-form" data-id="${grievanceId}">
                        <select name="status">
                            <option value="Pending" ${g.status === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
                            <option value="Working on it" ${g.status === 'Working on it' ? 'selected' : ''}>🛠️ Working on it</option>
                            <option value="Resolved" ${g.status === 'Resolved' ? 'selected' : ''}>✅ Resolved</option>
                        </select>
                        <button type="submit">Update</button>
                    </form>
                </div>`;
        });
        receivedList.innerHTML = html;
        
        // Attach event listeners to the new forms
        receivedList.querySelectorAll('.status-update-form').forEach(form => {
            form.addEventListener('submit', e => {
                e.preventDefault();
                const newStatus = form.querySelector('select').value;
                const docId = form.dataset.id;
                db.collection('grievances').doc(docId).update({ status: newStatus });
            });
        });
    });
     // Initialize the form if on the grievance page
    if (window.location.pathname.split("/").pop() === 'grievance.html') {
        initGrievanceForm();
    }
};

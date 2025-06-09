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

document.addEventListener("DOMContentLoaded", () => {
    const page = window.location.pathname.split("/").pop();

    // --- AUTH STATE & PAGE PROTECTION ---
    auth.onAuthStateChanged(user => {
        const protectedPages = ["grievance.html", "dashboard.html", "thankyou.html"];
        if (user) {
            // User is logged in
            if (page === 'login.html' || page === 'register.html') {
                window.location.href = 'dashboard.html';
            }
        } else {
            // User is not logged in
            if (protectedPages.includes(page)) {
                window.location.href = 'login.html';
            }
        }
    });


    // --- AUTHENTICATION ---
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('username').value; // Using email as username
            const password = document.getElementById('password').value;

            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    alert('Registration successful! Please log in.');
                    window.location.href = 'login.html';
                })
                .catch(error => alert(error.message));
        });
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            auth.signInWithEmailAndPassword(email, password)
                .then(userCredential => {
                    alert('Login successful!');
                    window.location.href = 'dashboard.html';
                })
                .catch(error => alert(error.message));
        });
    }

    // --- LOGOUT ---
    const logoutLinks = document.querySelectorAll('#logout');
    logoutLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => {
                alert('You have been logged out.');
                window.location.href = 'login.html';
            });
        });
    });


    // --- GRIEVANCE HANDLING ---
    const grievanceForm = document.getElementById('grievanceForm');
    if (grievanceForm) {
        grievanceForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return;

            db.collection('grievances').add({
                title: document.getElementById('title').value,
                description: document.getElementById('description').value,
                mood: document.getElementById('mood').value,
                severity: document.getElementById('severity').value,
                date: firebase.firestore.FieldValue.serverTimestamp(),
                userId: user.uid, // Link grievance to the user
                userEmail: user.email
            }).then(() => {
                window.location.href = 'thankyou.html';
            }).catch(error => alert(error.message));
        });
    }


    // --- DISPLAY DATA ON PAGES ---
    if (page === 'dashboard.html') {
        const user = auth.currentUser;
        if (user) {
            document.getElementById('welcome-user').innerText = `Welcome, ${user.email}!`;
            const grievanceList = document.getElementById('grievance-list');

            db.collection('grievances').where("userId", "==", user.uid).orderBy("date", "desc").get()
                .then(querySnapshot => {
                    if (querySnapshot.empty) {
                        grievanceList.innerHTML = '<p>You have not submitted any grievances yet.</p>';
                        return;
                    }
                    let html = '';
                    querySnapshot.forEach(doc => {
                        const g = doc.data();
                        html += `
                            <div class="grievance-item">
                                <h4>${g.title}</h4>
                                <p>${g.description}</p>
                                <div class="meta">
                                    <span><strong>Mood:</strong> ${g.mood}</span> | 
                                    <span><strong>Severity:</strong> ${g.severity}</span><br>
                                    <span><strong>Submitted:</strong> ${g.date ? g.date.toDate().toLocaleString() : 'Just now'}</span>
                                </div>
                            </div>
                        `;
                    });
                    grievanceList.innerHTML = html;
                });
        }
    }

    if (page === 'thankyou.html') {
        const user = auth.currentUser;
        if (user) {
             document.getElementById('thank-you-name').innerHTML = `Thank you, ${user.email}! 💖`;
        }
    }
});

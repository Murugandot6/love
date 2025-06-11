/* =========================================================
   love-app-final.js – FINAL UNIFIED SCRIPT
   ========================================================= */

/* ---------- Firebase Config & Initialisation ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyA8QfLoifA2-DjldYaMBeIge1D6TbRpBWw",
  authDomain: "summa-57ad5.firebaseapp.com",
  projectId: "summa-57ad5",
  storageBucket: "summa-57ad5.appspot.com",
  messagingSenderId: "472212537134",
  appId: "1:472212537134:web:fc930ea95fa9b7ffc4c4bf"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* ---------- Utility: deterministic heart-icon per UID ---------- */
const HEARTS = ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎"];
function assignUserIcon(uid) {
    return HEARTS[uid.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % HEARTS.length];
}

/* ---------- Bootstrapping / Routing ---------- */
document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(user => {
        const page = location.pathname.split('/').pop();
        const protectedPages = ["dashboard.html", "grievance.html", "profile.html"];
        const authPages = ["login.html", "register.html", "index.html", ""];

        if (user) {
            if (authPages.includes(page)) {
                return location.replace("dashboard.html");
            }
            if (page === "dashboard.html") loadDashboard();
            if (page === "profile.html") loadProfilePage();
            if (page === "grievance.html") initGrievanceForm();
        } else {
            if (protectedPages.includes(page)) {
                location.replace("login.html");
            }
        }
    });

    const page = location.pathname.split('/').pop();
    if (page === "register.html") initRegisterForm();
    if (page === "login.html") initLoginForm();

    document.body.addEventListener('click', e => {
        if (e.target.closest('#logout')) {
            e.preventDefault();
            auth.signOut().then(() => location.replace("login.html"));
        }
    });

    document.addEventListener("submit", async e => {
        if (!e.target.matches(".status-update-form")) return;
        e.preventDefault();
        const form = e.target;
        try {
            await db.collection("grievances").doc(form.dataset.id).update({ status: form.status.value });
        } catch (err) {
            console.error("Status update error:", err);
            alert(err.message);
        }
    });
});


/* ======================================================
   AUTH: Register & Login
   ====================================================== */
function initRegisterForm() {
    const form = document.getElementById("registerForm");
    if (!form) return;

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const nickname = form.nickname.value.trim();
        const email = form.email.value.trim().toLowerCase();
        const password = form.password.value;
        const partnerEmail = form.partnerEmail.value.trim().toLowerCase();

        try {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            // This is now the ONLY place a user profile is created at registration.
            await db.collection("users").doc(cred.user.uid).set({
                email: email,
                nickname: nickname,
                partnerEmail: partnerEmail,
                userIcon: assignUserIcon(cred.user.uid),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("Registration successful! Welcome!");
            location.replace("dashboard.html");
        } catch (err) {
            console.error("Register error:", err);
            alert(err.message);
        }
    });
}

function initLoginForm() {
    const form = document.getElementById("loginForm");
    if (!form) return;

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const email = form.email.value.trim().toLowerCase();
        const password = form.password.value;
        try {
            await auth.signInWithEmailAndPassword(email, password);
            location.replace("dashboard.html");
        } catch (err) {
            console.error("Login error:", err);
            alert(err.message);
        }
    });
}

/* ======================================================
   PROFILE PAGE
   ====================================================== */
function loadProfilePage() {
    const user = auth.currentUser;
    if (!user) return;
    initProfileForm(user);

    db.collection("users").doc(user.uid).get().then(doc => {
        document.getElementById("profile-icon-preview").textContent = doc.exists ? doc.data().userIcon : assignUserIcon(user.uid);
        if (!doc.exists) return;
        const userData = doc.data();
        document.getElementById("nickname").value = userData.nickname || "";
        document.getElementById("partnerEmail").value = userData.partnerEmail || "";
    }).catch(err => console.error("Profile load:", err));
}

function initProfileForm(user) {
    const form = document.getElementById("profileForm");
    if (!form) return;
    form.addEventListener("submit", async e => {
        e.preventDefault();
        const nickname = form.nickname.value.trim();
        const partnerEmail = form.partnerEmail.value.trim().toLowerCase();
        try {
            // .set with merge is perfect. It creates or updates.
            await db.collection("users").doc(user.uid).set({ nickname, partnerEmail }, { merge: true });
            alert("Profile updated!");
            location.replace("dashboard.html");
        } catch (err) {
            console.error("Profile update:", err);
            alert(err.message);
        }
    });
}

/* ======================================================
   GRIEVANCE SUBMISSION
   ====================================================== */
function initGrievanceForm() {
    const form = document.getElementById("grievanceForm");
    if (!form) return;
    const btn = form.querySelector("button[type='submit']");

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;
        btn.disabled = true;
        btn.innerHTML = "<i class='iconoir-clock'></i> Submitting...";

        try {
            const userDoc = await db.collection("users").doc(user.uid).get();
            if (!userDoc.data()?.partnerEmail) {
                alert("Please set your partner's email in your profile first.");
                return location.replace("profile.html");
            }
            const userData = userDoc.data();
            const partnerQuery = await db.collection("users").where("email", "==", userData.partnerEmail).limit(1).get();
            const partnerId = partnerQuery.empty ? null : partnerQuery.docs[0].id;

            await db.collection("grievances").add({
                title: form.title.value.trim(),
                description: form.description.value.trim(),
                mood: form.mood.value,
                severity: form.severity.value,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                senderId: user.uid,
                senderNickname: userData.nickname,
                receiverId: partnerId,
                receiverEmail: userData.partnerEmail,
                status: "Pending"
            });
            location.replace("thankyou.html");
        } catch (err) {
            console.error("Grievance error:", err);
            alert(err.message);
            btn.disabled = false;
            btn.innerHTML = "<i class='iconoir-send'></i> Submit 💌";
        }
    });
}

/* ======================================================
   DASHBOARD
   ====================================================== */
async function loadDashboard() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const userDoc = await db.collection("users").doc(user.uid).get();
        
        // **THIS IS THE FINAL FIX**
        // If a user is logged in but has no profile document, we send them to create one.
        if (!userDoc.exists()) {
            alert("Welcome! Let's set up your profile.");
            return location.replace("profile.html");
        }
        
        const userData = userDoc.data();
        document.getElementById("welcome-user").innerText = `Welcome, ${userData.nickname || user.email}!`;
        document.getElementById("user-icon").textContent = userData.userIcon;
        document.querySelector("#user-profile p").textContent = userData.nickname || "You";

        if (userData.partnerEmail) {
            const partnerQuery = await db.collection("users").where("email", "==", userData.partnerEmail).limit(1).get();
            const partnerIconEl = document.getElementById("partner-icon");
            const partnerNameEl = document.querySelector("#partner-profile p");
            if (!partnerQuery.empty) {
                const partnerData = partnerQuery.docs[0].data();
                partnerIconEl.textContent = partnerData.userIcon || "💜";
                partnerNameEl.textContent = partnerData.nickname || "Partner";
            } else {
                partnerIconEl.textContent = "❔";
                partnerNameEl.textContent = "Partner (Unregistered)";
            }
        }
        loadGrievances(user.uid, "sent");
        loadGrievances(user.email, "received");
    } catch (err) {
        console.error("Dashboard load:", err);
        alert(err.message);
    }
}

function loadGrievances(identifier, type) {
    const listEl = document.getElementById(`${type}-grievances-list`);
    if (!listEl) return;
    const queryField = type === "sent" ? "senderId" : "receiverEmail";

    db.collection("grievances").where(queryField, "==", identifier).orderBy("timestamp", "desc")
        .onSnapshot(snap => {
            if (snap.empty) {
                listEl.innerHTML = `<p>${type === "sent" ? "No grievances sent yet." : "Hooray! No grievances received."}</p>`;
                return;
            }
            listEl.innerHTML = snap.docs.map(doc => {
                const g = doc..data();
                return `<div class="grievance-item">
                  <h4>${g.title}</h4>
                  <p>${g.description}</p>
                  <div class="meta">
                    <span>Mood: ${g.mood} | Severity: ${g.severity}</span><br>
                    <span>${g.timestamp ? g.timestamp.toDate().toLocaleDateString() : ""}</span>
                  </div>
                  <div class="grievance-status">Status: ${g.status}</div>
                  ${type === "received" ? statusUpdateForm(doc.id, g.status) : ""}
               </div>`;
            }).join('');
        }, err => {
            console.error("Grievance load:", err);
            listEl.innerHTML = "<p style='color:red'>Error loading grievances.</p>";
        });
}

function statusUpdateForm(docId, currentStatus) {
    return `<form class="status-update-form" data-id="${docId}">
            <select name="status">
              <option value="Pending" ${currentStatus === "Pending" ? "selected" : ""}>⏳ Pending</option>
              <option value="Working on it" ${currentStatus === "Working on it" ? "selected" : ""}>🛠️ Working on it</option>
              <option value="Resolved" ${currentStatus === "Resolved" ? "selected" : ""}>✅ Resolved</option>
            </select>
            <button type="submit">Update</button>
          </form>`;
}

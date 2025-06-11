/* =============================
   Firebase Love App – v2.0
   --------------------------------
   Changes in this version
   - Creates a user profile doc automatically on first sign‑in so the
     dashboard never shows the “Your profile data is missing” alert.
   - Stores all e‑mails in lower‑case for reliable look‑ups.
   - Fixes wrong storageBucket URL (must end with .appspot.com).
   - Adds `createdAt` (server timestamp) to every new user.
   - Adds defensive null checks throughout.
   ============================= */

// --- Your Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyA8QfLoifA2-DjldYaMBeIge1D6TbRpBWw",
  authDomain: "summa-57ad5.firebaseapp.com",
  projectId: "summa-57ad5",
  storageBucket: "summa-57ad5.appspot.com",   // ← fixed domain
  messagingSenderId: "472212537134",
  appId: "1:472212537134:web:fc930ea95fa9b7ffc4c4bf"
};

// --- INITIALIZE FIREBASE SERVICES ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

/* ------------------------------------------------------------------
   HEART‑ICON UTILITY
------------------------------------------------------------------ */
const heartEmojis = [
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎"
];
const assignUserIcon = (uid) => {
  const charCodeSum = uid.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return heartEmojis[charCodeSum % heartEmojis.length];
};

/* ------------------------------------------------------------------
   ROUTING / ENTRY POINT
------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(async (user) => {
    const page = window.location.pathname.split("/").pop();
    const protectedPages = ["dashboard.html", "grievance.html", "profile.html"];
    const authPages      = ["login.html", "register.html", "index.html", ""];

    if (user) {
      // 💡 NEW: make sure the user has a profile document first
      await ensureUserProfile(user);

      if (authPages.includes(page)) {
        return window.location.replace("dashboard.html");
      }
      if (protectedPages.includes(page)) {
        if (page === "dashboard.html") loadDashboard();
        if (page === "profile.html")   loadProfilePage();
        if (page === "grievance.html") initGrievanceForm();
      }
    } else {
      // not signed in
      if (protectedPages.includes(page)) {
        window.location.replace("login.html");
      }
    }
  });

  // independent page initialisers ----------------------------------
  const page = window.location.pathname.split("/").pop();
  if (page === "register.html") initRegisterForm();
  if (page === "login.html")    initLoginForm();

  // global logout handler ------------------------------------------
  document.body.addEventListener("click", (e) => {
    if (e.target.closest("#logout")) {
      e.preventDefault();
      auth.signOut().then(() => window.location.replace("login.html"));
    }
  });
});

/* ------------------------------------------------------------------
   HELPERS
------------------------------------------------------------------ */

// Ensures a /users/{uid} document exists. Creates a stub if missing.
async function ensureUserProfile(user) {
  const userRef = db.collection("users").doc(user.uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    const profile = {
      email: (user.email || "").toLowerCase(),
      nickname: user.displayName || "",
      partnerEmail: "",      // user can add later
      userIcon: assignUserIcon(user.uid),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await userRef.set(profile);
  }
}

/* ------------------------------------------------------------------
   AUTH – REGISTER / LOGIN
------------------------------------------------------------------ */

function initRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nickname     = form.nickname.value.trim();
    const email        = form.email.value.trim().toLowerCase();
    const password     = form.password.value;
    const partnerEmail = form.partnerEmail.value.trim().toLowerCase();

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const userIcon = assignUserIcon(cred.user.uid);

      await db.collection("users").doc(cred.user.uid).set({
        email,
        nickname,
        partnerEmail,
        userIcon,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert("Registration successful! Welcome!");
      window.location.replace("dashboard.html");
    } catch (err) {
      console.error("Registration Error:", err);
      alert(`Error: ${err.message}`);
    }
  });
}

function initLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email    = form.email.value.trim().toLowerCase();
    const password = form.password.value;

    try {
      await auth.signInWithEmailAndPassword(email, password);
      // ensure profile exists even if user registered a long time ago
      await ensureUserProfile(auth.currentUser);
      window.location.replace("dashboard.html");
    } catch (err) {
      console.error("Login Failed:", err);
      alert(`Login Failed: ${err.message}`);
    }
  });
}

/* ------------------------------------------------------------------
   PROFILE PAGE
------------------------------------------------------------------ */

function loadProfilePage() {
  const user = auth.currentUser;
  if (!user) return;

  initProfileForm(user);

  db.collection("users").doc(user.uid).get()
    .then((doc) => {
      if (!doc.exists) return; // impossible now but safety first
      const data = doc.data();
      document.getElementById("nickname").value      = data.nickname     || "";
      document.getElementById("partnerEmail").value  = data.partnerEmail || "";
      document.getElementById("profile-icon-preview").textContent = data.userIcon || "❤️";
    })
    .catch((err) => console.error("Error loading profile data:", err));
}

function initProfileForm(user) {
  const form = document.getElementById("profileForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nickname     = form.nickname.value.trim();
    const partnerEmail = form.partnerEmail.value.trim().toLowerCase();

    try {
      await db.collection("users").doc(user.uid).set({
        nickname,
        partnerEmail
      }, { merge: true });

      alert("Profile updated successfully!");
      window.location.replace("dashboard.html");
    } catch (err) {
      console.error("Profile Update Error:", err);
      alert(`Failed to update profile: ${err.message}`);
    }
  });
}

/* ------------------------------------------------------------------
   GRIEVANCE SUBMISSION
------------------------------------------------------------------ */

function initGrievanceForm() {
  const form = document.getElementById("grievanceForm");
  if (!form) return;

  const submitBtn = form.querySelector("button[type='submit']");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = "<i class='iconoir-clock'></i> Submitting...";

    try {
      const userSnap = await db.collection("users").doc(user.uid).get();
      const userData = userSnap.data();

      if (!userData.partnerEmail) {
        alert("Please set your partner's e‑mail in your profile first!");
        return window.location.replace("profile.html");
      }

      // find partner by e‑mail (always lower‑case)
      const partnerQuery = await db.collection("users")
        .where("email", "==", userData.partnerEmail)
        .limit(1).get();

      const partnerId = partnerQuery.empty ? null : partnerQuery.docs[0].id;

      await db.collection("grievances").add({
        title:       form.title.value.trim(),
        description: form.description.value.trim(),
        mood:        form.mood.value,
        severity:    form.severity.value,
        timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
        senderId:    user.uid,
        senderNickname: userData.nickname,
        receiverId:  partnerId,
        receiverEmail: userData.partnerEmail,
        status:      "Pending"
      });

      window.location.replace("thankyou.html");
    } catch (err) {
      console.error("Grievance Submission Error:", err);
      alert(`Failed to send grievance: ${err.message}`);
      submitBtn.disabled = false;
      submitBtn.innerHTML = "<i class='iconoir-send'></i> Submit 💌";
    }
  });
}

/* ------------------------------------------------------------------
   DASHBOARD
------------------------------------------------------------------ */

async function loadDashboard() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const userSnap = await db.collection("users").doc(user.uid).get();
    const userData = userSnap.data();

    // UI – greeting
    document.getElementById("welcome-user").innerText =
      `Welcome, ${userData.nickname || user.email}!`;
    document.getElementById("user-icon").textContent = userData.userIcon;
    document.querySelector("#user-profile p").textContent = userData.nickname || "You";

    // UI – partner details if any ----------------------------------
    if (userData.partnerEmail) {
      const partnerQuery = await db.collection("users")
        .where("email", "==", userData.partnerEmail)
        .limit(1).get();
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

    // load grievances corresponding to this user -------------------
    loadGrievances(user.uid,  "sent");       // sent by me
    loadGrievances(user.email.toLowerCase(), "received"); // received by me

  } catch (err) {
    console.error("Error loading dashboard:", err);
    alert(`An error occurred: ${err.message}`);
  }
}

function loadGrievances(identifier, type) {
  const listEl = document.getElementById(`${type}-grievances-list`);
  if (!listEl) return;

  const field = type === "sent" ? "senderId" : "receiverEmail";

  db.collection("grievances")
    .where(field, "==", identifier)
    .orderBy("timestamp", "desc")
    .onSnapshot(
      (snap) => {
        if (snap.empty) {
          return listEl.innerHTML = `<p>${type === "sent" ? "No grievances sent yet." : "Hooray! No grievances received."}</p>`;
        }

        const items = [];
        snap.forEach((doc) => {
          const g = doc.data();
          items.push(`
            <div class="grievance-item">
              <h4>${g.title}</h4>
              <p>${g.description}</p>
              <div class="meta">
                <span>Mood: ${g.mood} | Severity: ${g.severity}</span><br>
                <span>Sent on: ${g.timestamp ? g.timestamp.toDate().toLocaleDateString() : "N/A"}</span>
              </div>
              <div class="grievance-status">Status: ${g.status}</div>
              ${ type === "received" ? getStatusUpdateForm(doc.id, g.status) : "" }
            </div>`);
        });
        listEl.innerHTML = items.join("");
      },
      (err) => {
        console.error(`Error loading ${type} grievances:`, err);
        listEl.innerHTML = `<p style="color:red;">Error: Could not load grievances.</p>`;
      }
    );
}

function getStatusUpdateForm(docId, currentStatus) {
  return `
    <form class="status-update-form" data-id="${docId}">
      <select name="status">
        <option value="Pending" ${currentStatus === "Pending" ? "selected" : ""}>⏳ Pending</option>
        <option value="Working on it" ${currentStatus === "Working on it" ? "selected" : ""}>🛠️ Working on it</option>
        <option value="Resolved" ${currentStatus === "Resolved" ? "selected" : ""}>✅ Resolved</option>
      </select>
      <button type="submit">Update</button>
    </form>`;
}

// Real‑time status‑update listener (delegated) ---------------------
document.addEventListener("submit", async (e) => {
  if (!e.target.matches(".status-update-form")) return;
  e.preventDefault();

  const form   = e.target;
  const status = form.status.value;
  const id     = form.dataset.id;

  try {
    await db.collection("grievances").doc(id).update({ status });
  } catch (err) {
    console.error("Status update failed:", err);
    alert(`Couldn't update status: ${err.message}`);
  }
});

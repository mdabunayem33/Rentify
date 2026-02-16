/* ---------- Firebase Init (compat, to match your project) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyA-Fv4SsvvMu8K2-eEk4t3ffWB_brbMoJU",
  authDomain: "rentify-58df7.firebaseapp.com",
  projectId: "rentify-58df7",
  storageBucket: "rentify-58df7.appspot.com",
  messagingSenderId: "892024907401",
  appId: "1:892024907401:web:35876b5cd252f9f81c0858",
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* ---------- Small helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const statusBox = $("#status");
function showStatus(msg, type = "info") {
  statusBox.style.display = "block";
  statusBox.textContent = msg;
  statusBox.className = `status ${
    type === "error" ? "error" : type === "success" ? "success" : ""
  }`;
}
function clearStatus() {
  statusBox.style.display = "none";
  statusBox.textContent = "";
  statusBox.className = "status";
}
function getActiveRole(containerId) {
  const btn = $(`#${containerId} .seg-btn.active`);
  return btn?.dataset.role || "landlord";
}
function setActive(btn, groupSel) {
  $$(groupSel).forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

/* ---------- Tabs (Login default) ---------- */
const tabs = $$(".tab");
const panels = $$(".panel");
function openTab(name) {
  tabs.forEach((t) => {
    const active = t.dataset.tab === name;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });
  panels.forEach((p) => p.classList.toggle("active", p.id === `panel-${name}`));
  clearStatus();
}
tabs.forEach((t) => t.addEventListener("click", () => openTab(t.dataset.tab)));
$("#go-login")?.addEventListener("click", (e) => {
  e.preventDefault();
  openTab("login");
});

/* Allow URL hash: #signup opens Sign Up, else Login as default */
if (location.hash.replace("#", "") === "signup") openTab("signup");
else openTab("login");

/* ---------- Role segmented controls ---------- */
$("#login-role")?.addEventListener("click", (e) => {
  if (e.target.matches(".seg-btn")) setActive(e.target, "#login-role .seg-btn");
});
$("#signup-role")?.addEventListener("click", (e) => {
  if (e.target.matches(".seg-btn"))
    setActive(e.target, "#signup-role .seg-btn");
});

/* ---------- Auth persistence ---------- */
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

/* ---------- SIGN UP ---------- */
$("#signup-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearStatus();

  const role = getActiveRole("signup-role"); // landlord | tenant
  const fullName = $("#signup-name").value.trim();
  const phone = $("#signup-phone").value.trim();
  const email = $("#signup-email").value.trim().toLowerCase();
  const password = $("#signup-password").value;
  const confirm = $("#signup-confirm").value;

  if (!fullName || !phone || !email || !password || !confirm) {
    showStatus("Please fill out all fields.", "error");
    return;
  }
  if (password !== confirm) {
    showStatus("Passwords do not match.", "error");
    return;
  }
  if (password.length < 6) {
    showStatus("Password must be at least 6 characters.", "error");
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const { uid } = cred.user;

    // Save profile to role-based collection
    const coll = role === "landlord" ? "landlords" : "tenants";
    await db.collection(coll).doc(uid).set({
      uid,
      role,
      fullName,
      phone,
      email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Optional: also a flat "users" collection (if you want cross-role lookups)
    await db.collection("users").doc(uid).set(
      {
        uid,
        role,
        fullName,
        phone,
        email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Sign out and return to login tab
    await auth.signOut();
    showStatus("Account created. Please log in.", "success");
    openTab("login");
  } catch (err) {
    const msg = (err && err.message) || "Could not create account.";
    showStatus(msg, "error");
  }
});

/* ---------- LOGIN ---------- */
$("#login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearStatus();

  const role = getActiveRole("login-role"); // landlord | tenant
  const email = $("#login-email").value.trim().toLowerCase();
  const password = $("#login-password").value;

  if (!email || !password) {
    showStatus("Please enter email and password.", "error");
    return;
  }

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const { uid } = cred.user;

    // Check role by verifying doc presence in the selected collection
    const selectedColl = role === "landlord" ? "landlords" : "tenants";
    const otherColl = role === "landlord" ? "tenants" : "landlords";

    const docSnap = await db.collection(selectedColl).doc(uid).get();

    if (docSnap.exists) {
      // Good: role matches selection → redirect
      if (role === "landlord") {
        window.location.href = "landlord_dashboard.html";
      } else {
        window.location.href = "tenant_dashboard.html";
      }
      return;
    }

    // If not found, try the opposite collection to give a helpful hint
    const otherSnap = await db.collection(otherColl).doc(uid).get();
    if (otherSnap.exists) {
      const realRole = otherColl === "landlords" ? "landlord" : "tenant";
      await auth.signOut();
      showStatus(
        `This account is registered as a ${realRole}. Please switch the role on the login screen.`,
        "error"
      );
      return;
    }

    // No profile found anywhere
    await auth.signOut();
    showStatus(
      "No profile found for this account. Please sign up first.",
      "error"
    );
  } catch (err) {
    const code = err && err.code;
    let msg = "Login failed.";
    if (code === "auth/user-not-found")
      msg = "No account found with that email.";
    else if (code === "auth/wrong-password") msg = "Incorrect password.";
    else if (code === "auth/too-many-requests")
      msg = "Too many attempts. Try again later.";
    else if (err && err.message) msg = err.message;
    showStatus(msg, "error");
  }
});

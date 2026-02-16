const firebaseConfig = {
  apiKey: "AIzaSyA-Fv4SsvvMu8K2-eEk4t3ffWB_brbMoJU",
  authDomain: "rentify-58df7.firebaseapp.com",
  projectId: "rentify-58df7",
  storageBucket: "rentify-58df7.appspot.com",
  messagingSenderId: "892024907401",
  appId: "1:892024907401:web:35876b5cd252f9f81c0858",
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Variable to store the currently selected role
let selectedRole = null;

const LANDLORD_DASHBOARD = "landlord_dashboard.html";
const TENANT_DASHBOARD = "tenant_dashboard.html";

// Helper function to get the correct collection name based on role
function getCollectionName(role) {
  if (role === "landlord") {
    return "landlords";
  } else {
    return "tenants";
  }
}

// Helper function to handle redirection
function redirectUser(role) {
  if (role === "landlord") {
    window.location.href = LANDLORD_DASHBOARD;
  } else if (role === "tenant") {
    window.location.href = TENANT_DASHBOARD;
  }
}

// FETCH USER DATA AND DISPLAY ON DASHBOARD
async function fetchUserDataAndDisplay(user, role) {
  const nameElement = document.getElementById("user-name");
  if (!nameElement) {
    return;
  }

  try {
    const collectionName = getCollectionName(role);
    const docRef = db.collection(collectionName).doc(user.uid);
    const docSnapshot = await docRef.get();

    if (docSnapshot.exists) {
      const userData = {
        ...docSnapshot.data(),
        uid: user.uid,
        email: user.email,
      };
      const userName = userData.name || userData.email;

      if (nameElement) {
        nameElement.textContent = userName;
      }

      if (
        role === "tenant" &&
        typeof window.updateTenantProfileUI === "function"
      ) {
        window.updateTenantProfileUI(userData);
      } else if (
        role === "landlord" &&
        typeof window.updateLandlordProfileUI === "function"
      ) {
        window.updateLandlordProfileUI(userData);
      }
    } else {
      if (nameElement) nameElement.textContent = "User";
      console.error("User data document not found in Firestore.");
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    if (nameElement) nameElement.textContent = "User";
  }
}

// LOGOUT FUNCTION
function handleLogout() {
  auth
    .signOut()
    .then(() => {
      console.log("User logged out successfully");
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Logout Error:", error.message);
      alert("Could not log out successfully. Please try again.");
    });
}

// DOM CONTENT LOADED
document.addEventListener("DOMContentLoaded", () => {
  // Role Selection Handler
  document.querySelectorAll(".role-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      document
        .querySelectorAll(".role-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      selectedRole = e.target.dataset.role;
    });
  });

  // Signup logic
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!selectedRole) {
        alert("Please select a role (Landlord or Tenant) first.");
        return;
      }

      const email = signupForm["signup-email"].value;
      const password = signupForm["signup-password"].value;
      const name = signupForm["signup-name"].value;
      const collectionName = getCollectionName(selectedRole);

      try {
        const userCredential = await auth.createUserWithEmailAndPassword(
          email,
          password
        );
        const user = userCredential.user;

        await db.collection(collectionName).doc(user.uid).set({
          name: name,
          email: email,
          role: selectedRole,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        redirectUser(selectedRole);
      } catch (error) {
        console.error("Signup Error:", error.message);
        alert(`Signup failed: ${error.message}`);
      }
    });
  }

  // Login logic
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!selectedRole) {
        alert("Please select a role (Landlord or Tenant) first.");
        return;
      }

      const collectionName = getCollectionName(selectedRole);
      const email = loginForm["login-email"].value;
      const password = loginForm["login-password"].value;

      try {
        const userCredential = await auth.signInWithEmailAndPassword(
          email,
          password
        );
        const user = userCredential.user;

        const userDoc = await db.collection(collectionName).doc(user.uid).get();

        if (!userDoc.exists) {
          await auth.signOut();
          alert(
            `Access Denied! You are not registered as a ${selectedRole} in our records. Please try logging in with the other role option or contact support.`
          );
          return;
        }

        const userRole = userDoc.data().role;
        redirectUser(userRole);
      } catch (error) {
        console.error("Login Error:", error.message);
        alert(`Login failed: ${error.message}`);
      }
    });
  }

  // Logout logic
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // Auth state observer
  auth.onAuthStateChanged((user) => {
    const currentPage = window.location.pathname.split("/").pop();

    if (user) {
      const checkLandlord = db.collection("landlords").doc(user.uid).get();
      const checkTenant = db.collection("tenants").doc(user.uid).get();

      Promise.all([checkLandlord, checkTenant]).then(
        ([landlordDoc, tenantDoc]) => {
          let role = null;

          if (landlordDoc.exists) {
            role = "landlord";
          } else if (tenantDoc.exists) {
            role = "tenant";
          }

          if (role) {
            const expectedDashboard =
              role === "landlord" ? LANDLORD_DASHBOARD : TENANT_DASHBOARD;

            if (currentPage === expectedDashboard) {
              fetchUserDataAndDisplay(user, role);
            }

            if (currentPage === "login.html" || currentPage === "signup.html") {
              window.location.href = expectedDashboard;
            } else if (
              currentPage !== expectedDashboard &&
              (currentPage === LANDLORD_DASHBOARD ||
                currentPage === TENANT_DASHBOARD)
            ) {
              window.location.href = expectedDashboard;
            }
          } else {
            auth.signOut();
          }
        }
      );
    } else {
      if (
        currentPage === LANDLORD_DASHBOARD ||
        currentPage === TENANT_DASHBOARD
      ) {
        window.location.href = "login.html";
      }
    }
  });
});

const navToggle = document.querySelector(".nav-toggle");
const navMain = document.querySelector(".nav-main");

navToggle.addEventListener("click", () => {
  navMain.classList.toggle("active");
  navToggle.classList.toggle("active");
});

// Close the mobile menu if a link is clicked
document.querySelectorAll(".nav-main a").forEach((link) => {
  link.addEventListener("click", () => {
    if (navMain.classList.contains("active")) {
      navMain.classList.remove("active");
      navToggle.classList.remove("active");
    }
  });
});

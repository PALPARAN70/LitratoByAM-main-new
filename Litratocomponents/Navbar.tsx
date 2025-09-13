"use client";
function LitratoNavbar() {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div>
      <div className="fixed top-[36px] left-1/2 transform -translate-x-1/2 w-[710px] h-[45px] bg-white z-99 rounded flex justify-around pt-[13px] items-center font-semibold text-[20px] shadow-md shadow-litratoblack">
        <p
          onClick={() => scrollToSection("home")}
          tabIndex={-1}
          className="cursor-pointer text-litratoblack select-none"
        >
          Home
        </p>
        <p
          onClick={() => scrollToSection("about")}
          tabIndex={-1}
          className="cursor-pointer text-litratoblack select-none"
        >
          About
        </p>
        <p
          onClick={() => scrollToSection("events")}
          tabIndex={-1}
          className="cursor-pointer text-litratoblack select-none"
        >
          Events
        </p>
        <p
          onClick={() => scrollToSection("services")}
          tabIndex={-1}
          className="cursor-pointer text-litratoblack select-none"
        >
          Services
        </p>
      </div>
    </div>
  );
}

export default LitratoNavbar;

"use client";

import Image from "next/image";
import LitratoNavbar from "../../../Litratocomponents/Navbar";
import LitratoBranding from "../../../Litratocomponents/Branding";
import Datepicker from "../../../Litratocomponents/availability_picker";
import ImageSlider from "../../../Litratocomponents/Carousel";
import PromoCard from "../../../Litratocomponents/Service_Card";
import LitratoFooter from "../../../Litratocomponents/Footer";
import { useRouter } from "next/navigation";
export default function HomePage() {
  const router = useRouter();
  const handleAvailableDate = () => {
    router.push("/availability");
  };
  const handleRegistration = () => {
    router.push("/registration");
  };
  const handleLogin = () => {
    router.push("/login");
  };
  return (
    <div>
      {/* Header Section */}
      <section id="home">
        <div className="relative h-56 w-full mb-6">
          <Image
            src="/Images/litratobg.jpg"
            alt="background_img"
            fill
            className="object-cover bg-no-repeat"
            priority
          ></Image>
          <div className="absolute top-[-25] left-0 w-full h-full flex items-center justify-center z-10 gap-5 pl-48">
            <LitratoNavbar />
            <div
              onClick={handleLogin}
              className="absolute top-[60] hover:scale-110 duration-500 right-60 bg-black text-white text-center font-semibold h-[45px] py-1 px-4 text-[20px] rounded-xl border-2 border-white hover:cursor-pointer shadow-md shadow-litratoblack"
            >
              LOGIN
            </div>
          </div>
        </div>
        <LitratoBranding />
        <div className="flex justify-self-center items-center mt-6 gap-2">
          <div onClick={handleAvailableDate}>
            <Datepicker />
          </div>
          
        </div>
      </section>
      <div className=" bg-litratored h-2 mt-5 "></div>
      <div className=" bg-litratoyellow h-2"></div>
      <div className=" bg-litratored h-2"></div>
      {/* About section */}
      <section
        id="about"
        className="flex flex-row justify-self-center gap-22 pt-20 mb-12"
      >
        <div className="flex flex-row gap-14 mt-12">
          <Image
            src="/Images/hanz.png"
            alt="display_img"
            width={100}
            height={10}
            className="w-[300px] h-[400px] object-cover bg-no-repeat rounded-2xl"
          ></Image>
          <Image
            src="/Images/litratobg.jpg"
            alt="display_img"
            width={100}
            height={10}
            className="w-[300px] h-[400px] object-cover bg-no-repeat rounded-2xl mt-20"
          />
        </div>

        <div className="flex flex-col">
          <p className="pl-24 text-4xl">ABOUT US</p>
          <p className="text-xl">Hello! We are Ace & Mikee of LITRATO</p>
          <p className="text-xl">
            Looking back, we've always had a knack for <br />
            vintage things, photography and collecting <br />
            memories as we travel, meet people and <br />
            experience life. With this, we want to share these <br />
            experiences and create memories with you <br /> through our simple
            photobooth, bringing retro and <br /> vintage vibes.
          </p>
          <p className="text-xl">
            With our passion for photography and love for <br />
            capturing memories, we came up with Litrato—a <br />
            vintage-inspired photobooth. We specialize in <br />
            providing unique and memorable experiences for <br /> events and
            gatherings through our retro-themed <br /> photobooths.
          </p>
          <p className="text-xl">We are LITRATO, moments in memories.</p>

          <div className="flex ml-24 hover:scale-110 duration-500 bg-litratoblack text-white w-40 py-8 justify-center items-center h-10 rounded-lg hover:cursor-pointer">
            Explore More
          </div>
        </div>
      </section>
      <div className=" bg-litratored h-2 mt-5 "></div>
      <div className=" bg-litratoyellow h-2"></div>
      <div className=" bg-litratored h-2"></div>
      {/* Events Section */}

      <section id="events">
        <ImageSlider></ImageSlider>
      </section>
      <div className=" bg-litratored h-2 mt-5 "></div>
      <div className=" bg-litratoyellow h-2"></div>
      <div className=" bg-litratored h-2"></div>
      {/* Service Section */}
      <section
        id="services"
        className="flex flex-row justify-self-center gap-40 mt-12"
      >
        <div className="flex flex-row gap-10">
          <PromoCard
            imageSrc="/Images/litratobg.jpg"
            title="The OG"
            price="₱8,000"
            descriptions={[
              "2 hours photo booth operation",
              "Vintage TV with video camera",
              "Unlimited shots",
              "High quality photo strips",
              "High quality of real time digital copy & GIFs",
              "Compiled soft copies of picture & GIF (via Gdrive)",
              "Customized welcome layout & photo strip",
              "6 photo grids to choose from (two free grids)",
              "Free transportation within DVO City",
              "On-site staff",
            ]}
          />
          <PromoCard
            imageSrc="/Images/litratobg.jpg"
            title="The OG"
            price="₱8,000"
            descriptions={[
              "2 hours photo booth operation",
              "Vintage TV with video camera",
              "Unlimited shots",
              "High quality photo strips",
              "High quality of real time digital copy & GIFs",
              "Compiled soft copies of picture & GIF (via Gdrive)",
              "Customized welcome layout & photo strip",
              "6 photo grids to choose from (two free grids)",
              "Free transportation within DVO City",
              "On-site staff",
            ]}
          />
        </div>
        <div className="flex flex-col">
          <Image
            src="/Images/litratopic.jpg"
            alt="litratobyam"
            width={100}
            height={10}
            className="w-[300px] h-[400px] object-cover bg-no-repeat rounded-2xl"
          ></Image>
          <div
            onClick={handleLogin}
            className="bg-litratoblack hover:scale-110 duration-500 text-white w-1/2 py-3 text-center rounded-xl hover:cursor-pointer self-center mt-20 font-bold"
          >
            {" "}
            BOOK NOW{" "}
          </div>
        </div>
      </section>
      {/* Footer Section */}
      <section>
        <LitratoFooter></LitratoFooter>
      </section>
    </div>
  );
}

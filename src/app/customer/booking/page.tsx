"use client";
import Image from "next/image";
import PromoCard from "../../../../Litratocomponents/Service_Card";
import Calendar from "../../../../Litratocomponents/LitratoCalendar";
import Timepicker from "../../../../Litratocomponents/Timepicker";
export default function BookingPage() {
  const formFields = [
    "Email:",
    "Facebook:",
    "Complete name:",
    "Contact #:",
    "Contact Person & Number:",
    "Name of event (Ex. Maria & Jose Wedding):",
    "Location of event:",
    "Extension? (Our Minimum is 2hrs. Additional hour is Php2000):",
    "Placement of booth (Indoor/Outdoor):",
    "What signal is currently strong in the event area?:",
  ];

  return (
    <div className="min-h-screen w-full overflow-y-auto">
      <div className="w-full">
        <div className="relative h-[160px]">
          <Image
            src={"/Images/litratobg.jpg"}
            alt="Booking Header"
            fill
            className="object-cover rounded-b-lg"
            priority
          />
        </div>
        <p className="text-litratoblack text-center text-4xl font-semibold font-didone pt-4">
          Welcome, Valued Customer! <br />
          Schedule a photobooth session with us!
        </p>
      </div>

      <div className=" p-4 rounded-lg shadow-md space-y-3">
        <p className="font-semibold text-xl">Please Fill In The Following:</p>
        {formFields.map((label, i) => (
          <div key={i}>
            <label className="block text-lg mb-1">{label}</label>
            <input
              type="text"
              placeholder="Enter here:"
              className="w-full bg-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
            />
          </div>
        ))}
        <div className="flex flex-col justify-center mt-8">
          <p className="font-semibold text-xl">Select A Package:</p>
          <div className="flex flex-row gap-4 justify-center">
            <PromoCard
              imageSrc="/Images/hanz.png"
              title="The Hanz"
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
              imageSrc="/Images/Gallery6.jpg"
              title="The Corrupt"
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
              imageSrc="/Images/gallery1.jpg"
              title="The AI"
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
        </div>

        <div className=" flex flex-col justify-center">
          <p className="font-semibold text-xl">
            Select the date and time for your event:
          </p>
          <div className="flex flex-row justify-center gap-24 ">
            <div>
              <Calendar></Calendar>
            </div>
            <div className="mt-8 ">
              <Timepicker></Timepicker>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

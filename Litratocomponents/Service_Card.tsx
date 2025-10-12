"use client";
import Image from "next/image";
type PromoCardProps = {
  imageSrc: string;
  title: string;
  price: string;
  descriptions: string[];
  // New optional props for selection
  selected?: boolean;
  onSelect?: () => void;
};

function PromoCard({
  imageSrc,
  title,
  price,
  descriptions,
  selected,
  onSelect,
}: PromoCardProps) {
  return (
    <div className="flex flex-row gap-14 mb-12 justify-center">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={!!selected}
        className={`flex flex-col rounded-t-xl w-[270px] max-h-[85vh] border-white shadow-neutral-200 shadow-md overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-litratored ${
          selected ? "ring-2 ring-litratored ring-offset-2" : ""
        }`}
      >
        {/* Header section */}
        <div className="bg-[#1E1E1E] flex flex-col rounded-t-[48px] relative">
          <div className="p-2 bg-[#1E1E1E] rounded-t-4xl shadow-md shadow-litratoblack">
            <Image
              src={imageSrc}
              alt="display_img"
              width={100}
              height={10}
              className="w-[260px] h-[200px] object-cover bg-no-repeat rounded-[32px]"
            />
          </div>
          <p className="text-white text-center pt-1 pb-2 text-[28px] font-didone">
            {title}
          </p>

          {/* Price circle */}
          <div className="absolute top-[100%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="rounded-full bg-white shadow-litratoblack/50 shadow-md p-0.3">
              <div className="rounded-full p-4 bg-litratoblack w-12 h-12 flex items-center justify-center text-white text-xs font-semibold border-4 border-white">
                {price}
              </div>
            </div>
          </div>
        </div>

        {/* Description list */}
        <div className="bg-white flex flex-col pt-10 overflow-y-auto h-full">
          {descriptions.map((item, index) => (
            <div
              key={index}
              className={`py-1.5 pl-4 text-[10px] flex flex-row leading-tight ${
                index % 2 === 0 ? "bg-[#F5F5F5]" : "bg-white"
              }`}
            >
              <Image
                src="/Icons/check.png"
                width={12}
                height={12}
                className="object-contain background-no-repeat mr-2"
                alt="check_icon"
              ></Image>
              {item}
            </div>
          ))}
        </div>
      </button>
    </div>
  );
}

export default PromoCard;

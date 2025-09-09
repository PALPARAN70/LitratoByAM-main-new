"use client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FilterIcon } from "lucide-react";

export default function InventoryManagementPage() {
  const filterOptions = [
    { label: "Package", value: "all" },
    { label: "Equipment", value: "active" },
    { label: "Log Items", value: "inactive" },
  ];
  return (
    <div className="h-screen flex flex-col p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Inventory</h1>
      </header>
      <nav className="flex gap-2  mb-6">
        <TabButton active={true} onClick={() => {}}>
          Package
        </TabButton>
        <TabButton active={false} onClick={() => {}}>
          Equipment
        </TabButton>
        <TabButton active={false} onClick={() => {}}>
          Log Items
        </TabButton>

        <div className="flex-grow flex">
          <form className="w-1/4 bg-gray-200 rounded-full items-center flex px-1 py-1">
            <input
              type="text"
              placeholder="Search User..."
              className="bg-transparent outline-none w-full px-2"
            />
            <Popover>
              <PopoverTrigger>
                <div className="rounded-full bg-gray-300 p-2 ml-2 items-center flex cursor-pointer">
                  <FilterIcon className="w-4 h-4 text-black" />
                </div>
              </PopoverTrigger>
              <PopoverContent>
                <p className="font-semibold">Filter Options...</p>
                {filterOptions.map((option) => (
                  <div
                    key={option.value + option.label}
                    className="p-2 rounded hover:bg-gray-100 cursor-pointer"
                  >
                    {option.label}
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          </form>
        </div>
      </nav>
      <section></section>
    </div>
  );

  // Panels
  function CreatePackagePanel() {
    return <div>Create Package</div>;
  }

  // Helper components
  function TabButton({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) {
    return (
      <div
        onClick={onClick}
        className={`px-4 py-2 rounded-full cursor-pointer border font-semibold transition
        ${
          active
            ? "bg-litratoblack text-white border-litratoblack"
            : "bg-white text-litratoblack border-gray-300 hover:bg-gray-100"
        }`}
      >
        {children}
      </div>
    );
  }
}

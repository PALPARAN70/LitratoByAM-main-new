"use client";
import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FilterIcon, MoreHorizontal as Ellipsis, Trash2 } from "lucide-react";
import MotionDiv from "../../../../Litratocomponents/MotionDiv";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import PromoCard from "../../../../Litratocomponents/Service_Card";
// Shared types hoisted for stability
type TabKey = "equipment" | "package" | "logitems";
type EquipmentTabKey = "available" | "unavailable";
type EquipmentRow = {
  id: string;
  name: string;
  type: string;
  totalQuantity: number;
  availableQuantity: number;
  condition: string;
  status: EquipmentTabKey;
  moreDetails: string;
  last_date_checked: string;
  notes: string;
  created_at: string;
  last_updated: string;
};

// Hoisted static filter options (prevents re-creation on each render)
const FILTER_OPTIONS = [
  { label: "Package", value: "all" },
  { label: "Equipment", value: "active" },
  { label: "Log Items", value: "inactive" },
];

export default function InventoryManagementPage() {
  const [active, setActive] = useState<TabKey>("equipment");

  return (
    <MotionDiv>
      <div className="h-screen flex flex-col p-4">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Inventory</h1>
        </header>
        <nav className="flex gap-2  mb-6">
          <TabButton
            active={active === "equipment"}
            onClick={() => setActive("equipment")}
          >
            Equipments
          </TabButton>
          <TabButton
            active={active === "package"}
            onClick={() => setActive("package")}
          >
            Packages
          </TabButton>
          <TabButton
            active={active === "logitems"}
            onClick={() => setActive("logitems")}
          >
            Log Items
          </TabButton>

          <div className="flex-grow flex">
            <form className="w-1/4 bg-gray-200 rounded-full items-center flex px-1 py-1">
              <input
                type="text"
                placeholder="Search User..."
                className="bg-transparent outline-none w-full px-2 h-8"
              />
              <Popover>
                <PopoverTrigger>
                  <div className="rounded-full bg-gray-300 p-2 ml-2 items-center flex cursor-pointer">
                    <FilterIcon className="w-4 h-4 text-black" />
                  </div>
                </PopoverTrigger>
                <PopoverContent>
                  <p className="font-semibold">Filter Options...</p>
                  {FILTER_OPTIONS.map((option) => (
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
        <section className="bg-white h-125 rounded-xl shadow p-4">
          {" "}
          {active === "equipment" && <CreateEquipmentPanel />}
          {active === "package" && <CreatePackagePanel />}
        </section>
      </div>
    </MotionDiv>
  );

  // Panels
  function CreateEquipmentPanel() {
    const [active, setActive] = useState<EquipmentTabKey>("available");
    const [items, setItems] = useState<EquipmentRow[]>([
      {
        id: "SKU-001",
        name: "Camera",
        type: "Photography",
        totalQuantity: 10,
        availableQuantity: 7,
        condition: "Good",
        status: "available",
        moreDetails: "View",
        last_date_checked: "2025-09-10",
        notes: "Lens cleaned. Battery health OK.",
        created_at: "2025-08-01 09:15am",
        last_updated: "2025-09-10 10:30pm",
      },
    ]);

    // Form state for the Add Equipment modal
    const [form, setForm] = useState({
      id: "",
      name: "",
      type: "",
      totalQuantity: 0,
      availableQuantity: 0,
      condition: "",
      status: "available" as EquipmentTabKey,
      last_date_checked: "",
      notes: "",
      created_at: "",
      last_updated: "",
    });
    const updateForm = <K extends keyof typeof form>(
      key: K,
      value: (typeof form)[K]
    ) => setForm((prev) => ({ ...prev, [key]: value }));
    const handleCreate = () => {
      const newItem: EquipmentRow = {
        id: form.id.trim() || `SKU-${Date.now()}`,
        name: form.name.trim(),
        type: form.type.trim(),
        totalQuantity: Number(form.totalQuantity) || 0,
        availableQuantity:
          Number(form.availableQuantity || form.totalQuantity) || 0,
        condition: form.condition.trim(),
        status: form.status,
        moreDetails: "View",
        last_date_checked: form.last_date_checked,
        notes: form.notes,
        created_at: form.created_at,
        last_updated: form.last_updated,
      };
      setItems((prev) => [...prev, newItem]);
      setForm({
        id: "",
        name: "",
        type: "",
        totalQuantity: 0,
        availableQuantity: 0,
        condition: "",
        status: "available",
        last_date_checked: "",
        notes: "",
        created_at: "",
        last_updated: "",
      });
    };

    // Generic form handlers to reduce inline functions
    const handleText = useCallback(
      (key: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          setForm((prev) => ({ ...prev, [key]: e.target.value })),
      [setForm]
    );
    const handleNumber = useCallback(
      (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [key]: Number(e.target.value) })),
      [setForm]
    );

    // Stable status update
    const updateStatus = useCallback(
      (id: string, status: EquipmentTabKey) =>
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status } : it))
        ),
      []
    );

    // NEW: delete handler
    const handleDelete = useCallback((id: string) => {
      if (typeof window !== "undefined") {
        const ok = window.confirm("Delete this item? This cannot be undone.");
        if (!ok) return;
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
    }, []);

    // Columns defined once
    const columns = useMemo(
      () => [
        { key: "id", label: "SKU" },
        { key: "name", label: "Name" },
        { key: "type", label: "Type" },
        { key: "totalQuantity", label: "Total Quantity" },
        { key: "availableQuantity", label: "Quantity" },
        { key: "condition", label: "Condition" },
        { key: "status", label: "Status" },
        { key: "moreDetails", label: "More Details" },
        // NEW: Actions column
        { key: "actions", label: "Actions" },
      ],
      []
    );

    // Memoized filtered rows
    const availableRows = useMemo(
      () => items.filter((it) => it.status === "available"),
      [items]
    );
    const unavailableRows = useMemo(
      () => items.filter((it) => it.status === "unavailable"),
      [items]
    );

    return (
      <MotionDiv>
        <div className="flex flex-col">
          <div className="flex justify-between border-b-2 border-black">
            <div className="flex flex-row gap-4 ">
              <h2>Equipment</h2>
              <div className="flex gap-2 mb-2">
                <TabButton
                  active={active === "available"}
                  onClick={() => setActive("available")}
                >
                  Available
                </TabButton>
                <TabButton
                  active={active === "unavailable"}
                  onClick={() => setActive("unavailable")}
                >
                  Unavailable
                </TabButton>
              </div>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-litratoblack text-white p-2 mb-2 rounded">
                  Add Equipment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[640px] max-h-[70vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>Add Equipment</DialogTitle>
                  <DialogDescription>
                    Provide the details for the new equipment.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto p-2">
                  <form
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    onSubmit={(e) => e.preventDefault()}
                  >
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">Name</label>
                      <Input
                        className="h-9 rounded-md border px-3 text-sm outline-none "
                        placeholder="e.g. Camera"
                        value={form.name}
                        onChange={handleText("name")}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">Type</label>
                      <Input
                        className="h-9 rounded-md border px-3 text-sm outline-none"
                        placeholder="e.g. Photography"
                        value={form.type}
                        onChange={handleText("type")}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">Condition</label>
                      <Input
                        className="h-9 rounded-md border px-3 text-sm outline-none "
                        placeholder="e.g. Good"
                        value={form.condition}
                        onChange={handleText("condition")}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        Total Quantity
                      </label>
                      <Input
                        type="number"
                        min={0}
                        className="h-9 rounded-md border px-3 text-sm outline-none "
                        value={form.totalQuantity}
                        onChange={handleNumber("totalQuantity")}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        Available Qty
                      </label>
                      <Input
                        type="number"
                        min={0}
                        className="h-9 rounded-md border px-3 text-sm outline-none"
                        value={form.availableQuantity}
                        onChange={handleNumber("availableQuantity")}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">Status</label>
                      <Select
                        value={form.status}
                        onValueChange={(value) =>
                          updateForm("status", value as EquipmentTabKey)
                        }
                      >
                        <SelectTrigger className="h-9 text-sm rounded">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="unavailable">
                            Unavailable
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-sm font-medium">
                        Last Date Checked
                      </label>
                      <Input
                        type="datetime-local"
                        className="h-9 rounded-md border px-3 text-sm outline-none "
                        value={form.last_date_checked}
                        onChange={handleText("last_date_checked")}
                      />
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-sm font-medium">Notes</label>
                      <Textarea
                        rows={2}
                        className="rounded-md border px-3 py-2 text-sm outline-none "
                        value={form.notes}
                        onChange={handleText("notes")}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">Created At</label>
                      <Input
                        type="datetime-local"
                        className="h-9 rounded-md border px-3 text-sm outline-none "
                        value={form.created_at}
                        onChange={handleText("created_at")}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        Last Updated
                      </label>
                      <Input
                        type="datetime-local"
                        className="h-9 rounded-md border px-3 text-sm outline-none"
                        value={form.last_updated}
                        onChange={handleText("last_updated")}
                      />
                    </div>
                  </form>
                </div>
                <DialogFooter className="mt-2">
                  <DialogClose asChild>
                    <Button
                      className="px-4 py-2 rounded border"
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      className="px-4 py-2 rounded bg-litratoblack text-white"
                      onClick={handleCreate}
                    >
                      Create
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <section className="mt-4">
            {active === "available" && <AvailableEquipmentPanel />}
            {active === "unavailable" && <UnavailableEquipmentPanel />}
          </section>
        </div>
      </MotionDiv>
    );

    // Equipment table components (internal, purely for deduping)
    function StatusSelect({
      value,
      onChange,
      triggerClassName,
    }: {
      value: EquipmentTabKey;
      onChange: (v: EquipmentTabKey) => void;
      triggerClassName: string;
    }) {
      return (
        <Select
          value={value}
          onValueChange={(v) => onChange(v as EquipmentTabKey)}
        >
          <SelectTrigger className={triggerClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="unavailable">Unavailable</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    function MoreDetailsCell({ row }: { row: EquipmentRow }) {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="More details"
              className="inline-flex items-center justify-center rounded border px-2 py-1 bg-gray-100 hover:bg-gray-200"
            >
              <Ellipsis className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 text-sm">
            <div className="space-y-1">
              <div>
                <span className="font-medium">Last checked: </span>
                {row.last_date_checked}
              </div>
              <div>
                <span className="font-medium">Notes: </span>
                {row.notes}
              </div>
              <div>
                <span className="font-medium">Created: </span>
                {row.created_at}
              </div>
              <div>
                <span className="font-medium">Updated: </span>
                {row.last_updated}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    function EquipmentTable({
      rows,
      triggerClassName,
    }: {
      rows: EquipmentRow[];
      triggerClassName: string;
    }) {
      return (
        <MotionDiv>
          <div className="flex flex-col">
            <div className="overflow-hidden rounded-t-md border">
              <Table className="w-full table-auto">
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead
                        key={col.key}
                        className="px-4 py-2 whitespace-nowrap text-left bg-gray-200"
                      >
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="text-left even:bg-gray-50"
                    >
                      {columns.map((col) => (
                        <TableCell
                          key={col.key}
                          className="px-4 py-2 whitespace-nowrap"
                        >
                          {col.key === "status" ? (
                            // was: <div className="inline-block w-40">
                            <div className="inline-block">
                              <StatusSelect
                                value={row.status}
                                onChange={(v) => updateStatus(row.id, v)}
                                triggerClassName={triggerClassName}
                              />
                            </div>
                          ) : col.key === "moreDetails" ? (
                            <MoreDetailsCell row={row} />
                          ) : col.key === "actions" ? (
                            // changed: icon-only delete
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id)}
                              aria-label={`Delete ${row.name}`}
                              title="Delete"
                              className="inline-flex justify-center rounded-full text-litratored hover:text-red-600"
                            >
                              <Trash2 />
                            </button>
                          ) : (
                            String((row as any)[col.key])
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </MotionDiv>
      );
    }

    function AvailableEquipmentPanel() {
      return (
        <EquipmentTable
          rows={availableRows}
          triggerClassName=" text-sm rounded"
        />
      );
    }
    function UnavailableEquipmentPanel() {
      return (
        <EquipmentTable
          rows={unavailableRows}
          triggerClassName="h-9 rounded text-sm"
        />
      );
    }
  }

  function CreatePackagePanel() {
    type PackageItem = {
      id: string;
      name: string;
      price: number;
      imageUrl: string;
      features: string[];
    };

    const [open, setOpen] = useState(false);
    const [packages, setPackages] = useState<PackageItem[]>([]);
    const [pkgForm, setPkgForm] = useState<{
      name: string;
      price: number;
      imageUrl: string;
      imageName: string;
      features: string[];
    }>({
      name: "",
      price: 0,
      imageUrl: "",
      imageName: "",
      features: [""],
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setPkgForm((p) => {
        // safe to revoke only the previous form preview (not used by created packages)
        if (p.imageUrl && p.imageUrl.startsWith("blob:")) {
          URL.revokeObjectURL(p.imageUrl);
        }
        return { ...p, imageUrl: url, imageName: file.name };
      });
    };
    const handleClearImage = () => {
      setPkgForm((p) => {
        if (p.imageUrl && p.imageUrl.startsWith("blob:")) {
          URL.revokeObjectURL(p.imageUrl);
        }
        return { ...p, imageUrl: "", imageName: "" };
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const updateField =
      (key: "name" | "price") => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = key === "price" ? Number(e.target.value) : e.target.value;
        setPkgForm((p) => ({ ...p, [key]: value as any }));
      };
    const updateFeature =
      (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setPkgForm((p) => {
          const features = [...p.features];
          features[idx] = e.target.value;
          return { ...p, features };
        });
      };
    const addFeature = () =>
      setPkgForm((p) => ({ ...p, features: [...p.features, ""] }));
    const removeFeature = (idx: number) =>
      setPkgForm((p) => {
        const features = p.features.filter((_, i) => i !== idx);
        return { ...p, features: features.length ? features : [""] };
      });

    const handleCreatePackage = () => {
      const name = pkgForm.name.trim();
      if (!name) return;

      const newPkg: PackageItem = {
        id: "PKG-" + Date.now(),
        name,
        price: Number(pkgForm.price) || 0,
        imageUrl: pkgForm.imageUrl,
        features: pkgForm.features.map((f) => f.trim()).filter(Boolean),
      };
      setPackages((prev) => [newPkg, ...prev]);

      // reset & close
      setPkgForm({
        name: "",
        price: 0,
        imageUrl: "",
        imageName: "",
        features: [""],
      });
      setOpen(false);
    };

    // Cast to any to align with your PromoCard API without forcing prop types here.
    const Promo = PromoCard as any;

    // Format PHP currency like the existing cards (e.g., ₱8,000)
    const formatPrice = (amount: number) =>
      new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
      }).format(Number.isFinite(amount) ? amount : 0);

    // Build props in the common shapes Service_Card implementations use
    const buildPromoProps = (pkg: PackageItem) => {
      const f = Array.isArray(pkg.features) ? pkg.features : [];
      const formattedPrice = formatPrice(pkg.price);
      const img = pkg.imageUrl;

      return {
        // names/titles
        title: pkg.name,
        name: pkg.name,
        packageName: pkg.name,

        // price variations
        price: formattedPrice,
        priceText: formattedPrice,
        displayPrice: formattedPrice,
        amount: pkg.price,
        value: pkg.price,

        // image aliases
        image: img,
        imageUrl: img,
        img: img,
        imgUrl: img,
        cover: img,
        coverImage: img,

        // features/inclusions aliases
        features: f,
        inclusions: f,
        includes: f,
        list: f,
        items: f,
        bullets: f,
        perks: f,
        services: f,

        // nested shapes some components expect
        service: {
          title: pkg.name,
          name: pkg.name,
          price: formattedPrice,
          image: img,
          imageUrl: img,
          inclusions: f,
          features: f,
          list: f,
        },
        data: {
          title: pkg.name,
          name: pkg.name,
          price: formattedPrice,
          image: img,
          imageUrl: img,
          inclusions: f,
          features: f,
          list: f,
        },
      };
    };

    // NEW: Error boundary + safe fallback card to avoid `.map` on undefined inside PromoCard
    class CardErrorBoundary extends React.Component<
      { fallback: React.ReactNode; children: React.ReactNode },
      { hasError: boolean }
    > {
      constructor(props: any) {
        super(props);
        this.state = { hasError: false };
      }
      static getDerivedStateFromError() {
        return { hasError: true };
      }
      componentDidCatch(error: any) {
        console.error("PromoCard render failed:", error);
      }
      render() {
        if (this.state.hasError) return this.props.fallback;
        return this.props.children;
      }
    }

    function SimplePackageCard({ pkg }: { pkg: PackageItem }) {
      const features = Array.isArray(pkg.features) ? pkg.features : [];
      return (
        <div className="border rounded-lg p-4 shadow-sm">
          {pkg.imageUrl ? (
            <img
              src={pkg.imageUrl}
              alt={pkg.name}
              className="w-full h-40 object-cover rounded"
            />
          ) : null}
          <div className="mt-3">
            <h3 className="font-semibold">{pkg.name}</h3>
            <p className="text-sm text-gray-600">{formatPrice(pkg.price)}</p>
            {features.length > 0 ? (
              <ul className="mt-2 list-disc list-inside text-sm">
                {features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      );
    }

    function SafePromoCard({ pkg }: { pkg: PackageItem }) {
      const props = buildPromoProps(pkg);
      return (
        <CardErrorBoundary fallback={<SimplePackageCard pkg={pkg} />}>
          <Promo {...props} />
        </CardErrorBoundary>
      );
    }

    return (
      <div className="flex flex-col">
        <div className="flex justify-between border-b-2 border-black">
          <div className="flex flex-row gap-4 ">
            <h2>Create Package</h2>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-litratoblack text-white p-2 mb-2 rounded"
                onClick={() => setOpen(true)}
              >
                Add Package
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[640px] max-h-[70vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Add Package</DialogTitle>
                <DialogDescription>
                  Provide the details for the new package.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto p-2">
                <form
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-sm font-medium">Package Image</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={onFileChange}
                      ref={fileInputRef}
                    />
                    {pkgForm.imageUrl ? (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm border">
                        <span
                          className="truncate max-w-[16rem]"
                          title={pkgForm.imageName || "Selected image"}
                        >
                          {pkgForm.imageName || "Selected image"}
                        </span>
                        <button
                          type="button"
                          className="text-gray-600 hover:text-black"
                          onClick={handleClearImage}
                          aria-label="Remove selected image"
                          title="Remove"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Package Name</label>
                    <Input
                      className="h-9 rounded-md border px-3 text-sm outline-none"
                      placeholder="e.g. Wedding Package"
                      value={pkgForm.name}
                      onChange={updateField("name")}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Package Price</label>
                    <Input
                      type="number"
                      min={0}
                      className="h-9 rounded-md border px-3 text-sm outline-none"
                      value={pkgForm.price}
                      onChange={updateField("price")}
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Features</label>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3"
                        onClick={addFeature}
                      >
                        Add Feature
                      </Button>
                    </div>

                    <div className="flex flex-col gap-2">
                      {pkgForm.features.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            className="h-9 rounded-md border px-3 text-sm outline-none"
                            placeholder={`Feature ${idx + 1}`}
                            value={feat}
                            onChange={updateFeature(idx)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9"
                            onClick={() => removeFeature(idx)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              </div>

              <DialogFooter className="mt-2">
                <DialogClose asChild>
                  <Button
                    className="px-4 py-2 rounded border"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  className="px-4 py-2 rounded bg-litratoblack text-white"
                  onClick={handleCreatePackage}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Render created packages as PromoCard(s) */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            // CHANGED: use SafePromoCard instead of direct Promo
            <SafePromoCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      </div>
    );
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

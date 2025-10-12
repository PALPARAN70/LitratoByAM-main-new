import { useEffect, useMemo, useState } from "react";

type TimepickerProps = {
  // 24h HH:mm inputs
  start?: string; // defaults to "07:00"
  end?: string; // defaults to "07:00"
  showEnd?: boolean; // render end-time UI; default true
  onChange?: (t: { start: string; end: string }) => void; // emits 24h HH:mm
};

function to24h(hour: string, minute: string, ampm: "am" | "pm") {
  let h = parseInt(hour, 10);
  if (Number.isNaN(h)) h = 0;
  h = h % 12;
  if (ampm === "pm") h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function from24h(time?: string): {
  hour: string;
  minute: string;
  ampm: "am" | "pm";
} {
  const [HH, MM] = (time ?? "07:00").split(":");
  let h = parseInt(HH ?? "7", 10);
  if (Number.isNaN(h)) h = 7;
  const ampm: "am" | "pm" = h >= 12 ? "pm" : "am";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return {
    hour: String(h12).padStart(2, "0"),
    minute: (MM ?? "00").padStart(2, "0"),
    ampm,
  };
}

export default function Timepicker({
  start,
  end,
  showEnd = true,
  onChange,
}: TimepickerProps) {
  const initial = useMemo(
    () => [from24h(start), from24h(end)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [times, setTimes] = useState([
    { hour: initial[0].hour, minute: initial[0].minute, ampm: initial[0].ampm },
    { hour: initial[1].hour, minute: initial[1].minute, ampm: initial[1].ampm },
  ]);

  // keep internal in sync if parent props change
  useEffect(() => {
    if (start) {
      const s = from24h(start);
      setTimes((prev) => [
        { hour: s.hour, minute: s.minute, ampm: s.ampm },
        prev[1],
      ]);
    }
  }, [start]);
  useEffect(() => {
    if (end) {
      const e = from24h(end);
      setTimes((prev) => [
        prev[0],
        { hour: e.hour, minute: e.minute, ampm: e.ampm },
      ]);
    }
  }, [end]);

  const hours = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, "0")
  );
  const minutes = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, "0")
  );
  const ampmOptions: Array<"am" | "pm"> = ["am", "pm"];

  const timePickers = [
    { label: "Start time of booth" },
    ...(showEnd ? [{ label: "End time of booth" }] : []),
  ];

  const emit = (nextTimes = times) => {
    const start24 = to24h(
      nextTimes[0].hour,
      nextTimes[0].minute,
      nextTimes[0].ampm as "am" | "pm"
    );
    const end24 = to24h(
      nextTimes[1].hour,
      nextTimes[1].minute,
      nextTimes[1].ampm as "am" | "pm"
    );
    onChange?.({ start: start24, end: end24 });
  };

  const handleSelect = (
    pickerIdx: number,
    field: "hour" | "minute" | "ampm",
    value: string
  ) => {
    setTimes((prev) => {
      const next = prev.map((t, idx) =>
        idx === pickerIdx ? { ...t, [field]: value } : t
      ) as typeof prev;
      emit(next);
      return next;
    });
  };

  return (
    <div className="flex flex-col rounded-lg p-4">
      <div className="flex flex-col gap-12">
        {timePickers.map((picker, idx) => (
          <div key={idx}>
            <p className="text-2xl font-semibold">{picker.label}</p>
            <div className="flex flex-row justify-center gap-16 items-center">
              {/* Hour */}
              <div className="relative">
                <select
                  className="bg-gray-400 p-2 rounded-md text-7xl cursor-pointer select-none appearance-none"
                  style={{ fontSize: "5rem", lineHeight: "1.1" }}
                  value={times[idx].hour}
                  onChange={(e) => handleSelect(idx, "hour", e.target.value)}
                >
                  {hours.map((h) => (
                    <option
                      key={h}
                      value={h}
                      style={{
                        fontSize: "1rem",
                        background: "#e5e7eb",
                        color: "#111",
                        textAlign: "center",
                      }}
                    >
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-7xl">:</p>
              {/* Minute */}
              <div className="relative">
                <select
                  className="bg-gray-200 p-2 rounded-md text-7xl cursor-pointer select-none appearance-none "
                  style={{ fontSize: "5rem", lineHeight: "1" }}
                  value={times[idx].minute}
                  onChange={(e) => handleSelect(idx, "minute", e.target.value)}
                >
                  {minutes.map((m) => (
                    <option
                      key={m}
                      value={m}
                      style={{
                        fontSize: "1rem",
                        background: "#f3f4f6",
                        color: "#111",
                        textAlign: "center",
                      }}
                    >
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              {/* AM/PM */}
              <div className="relative">
                <select
                  className="bg-gray-400 p-2 rounded-md text-2xl cursor-pointer select-none appearance-none"
                  style={{ fontSize: "2.5rem", lineHeight: "1.1" }}
                  value={times[idx].ampm}
                  onChange={(e) => handleSelect(idx, "ampm", e.target.value)}
                >
                  {ampmOptions.map((period) => (
                    <option
                      key={period}
                      value={period}
                      style={{
                        fontSize: "1rem",
                        background: "#e5e7eb",
                        color: "#111",
                        textAlign: "center",
                      }}
                    >
                      {period}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

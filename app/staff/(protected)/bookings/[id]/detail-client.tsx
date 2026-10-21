"use client";

import { useParams } from "next/navigation";
import { BookingDetail } from "@/components/staff/panels";

export function StaffBookingDetail() {
  const params = useParams<{ id: string }>();
  return <BookingDetail id={params.id} />;
}

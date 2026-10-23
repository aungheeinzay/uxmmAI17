"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { createParcelSchema, type CreateParcelFormValues } from "../schemas/create-parcel.schema";
import { useDeliveryCities } from "@/features/delivery/hooks/use-delivery-cities";
import { useDeliveryServices } from "@/features/delivery/hooks/use-delivery-services";
import type { DeliveryService } from "@/features/delivery/schemas/delivery.schema";
import { createOrder } from "../api/orders.api";
import { useAuthStore } from "@/stores/auth.store";

const townships = [
  "Bahan",
  "Dagon",
  "Hlaing",
  "Kamayut",
  "Kyauktada",
  "Lanmadaw",
  "Mayangone",
  "Sanchaung",
  "Tamwe",
  "Thanlyin",
];

function StepHeader({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] font-bold text-[#3D51A3]">
        {number}
      </span>
      <div className="space-y-0.5">
        <h2 className="text-[16px] font-bold text-[#111827]">{title}</h2>
        <p className="text-[12px] text-[#6B7280]">{subtitle}</p>
      </div>
    </div>
  );
}

function formatCityLabel(city: string) {
  return city.charAt(0).toUpperCase() + city.slice(1);
}

export function CreateParcelForm() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const { data: citiesData } = useDeliveryCities();
  const cities = useMemo(() => (citiesData?.cities ?? []), [citiesData]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateParcelFormValues>({
    resolver: zodResolver(createParcelSchema) as Resolver<CreateParcelFormValues>,
    defaultValues: {
      recipientName: "",
      phoneNumber: "",
      city: cities[0] ? formatCityLabel(cities[0]) : "",
      township: "",
      deliveryAddress: "",
      weight: 1.0,
      codAmount: 0,
      deliveryNote: "",
    },
  });

  const cityValue = useWatch({ control, name: "city" });
  const cityKey = cityValue ? cityValue.toLowerCase() : null;
  const { data: servicesData, error: servicesError } = useDeliveryServices(cityKey);

  const services = useMemo(() => servicesData?.services ?? [], [servicesData]);
  const selected = useMemo<DeliveryService | null>(() => {
    if (!services.length) return null;
    if (providerId) {
      const match = services.find(s => s.id === providerId);
      if (match) return match;
    }
    return services[0];
  }, [services, providerId]);

  useEffect(() => {
    if (cities.length && !cityValue) {
      setValue("city", formatCityLabel(cities[0]), { shouldValidate: false });
    }
  }, [cities, cityValue, setValue]);

  const onSubmit = async (values: CreateParcelFormValues) => {
    setProfileError(null);
    if (!selected || !cityKey) {
      alert("Please select a delivery provider.");
      return;
    }
    const senderName = user?.fullName?.trim();
    if (!senderName) {
      setProfileError("Add your name to your SME profile before creating a parcel. Your name is used as the sender; it will never be replaced with the recipient name.");
      return;
    }

    const payload = {
      recipientName: values.recipientName,
      phoneNumber: values.phoneNumber,
      township: values.township,
      deliveryAddress: values.deliveryAddress,
      parcelWeight: Number(values.weight),
      codAmount: Number(values.codAmount).toFixed(2),
      senderName,
      deliveryInstructions: values.deliveryNote || "",
      destinationCity: cityKey,
      deliveryProviderId: selected.id,
    };

    try {
      const result = (await createOrder(payload)) as {
        data?: { id?: string; orderCode?: string };
        id?: string;
        orderId?: string;
      };

      // Extract the order ID and navigate to the parcel details view
      const orderId = result?.data?.id ?? result?.data?.orderCode ?? result?.id ?? result?.orderId;

      if (orderId) {
        router.push(`/seller/parcels/${orderId}`);
      } else {
        router.push("/seller/all-parcels");
      }
    } catch (error) {
      console.error("Error creating order:", error);
      const message = error instanceof ApiError && error.code === "OPERATOR_NOT_AVAILABLE"
        ? "This delivery provider does not have an assigned operator yet. Please select another provider."
        : error instanceof Error ? error.message : "An unexpected error occurred.";
      alert(message);
    }
  };

  const subtitle = cityValue ? `Services available in ${cityValue}.` : "Select a destination city to see providers.";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8">
        {profileError ? (
          <Alert variant="destructive" role="alert" className="mb-6">
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span>{profileError}</span>
              <Link className="font-semibold underline underline-offset-2" href="/seller/settings">
                Open profile settings
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="space-y-8">
            <section className="space-y-5">
              <StepHeader number="01" title="Recipient details" subtitle="Information used by your delivery team." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="recipientName" className="text-body-md text-[#111827]">
                    Recipient name
                  </Label>
                  <Input
                    id="recipientName"
                    placeholder="e.g. မေသက်လှိုင်"
                    {...register("recipientName")}
                    aria-invalid={!!errors.recipientName}
                  />
                  {errors.recipientName ? <p className="text-body-sm text-destructive">{errors.recipientName.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-body-md text-[#111827]">
                    Phone number
                  </Label>
                  <Input
                    id="phoneNumber"
                    placeholder="09 777 123 456"
                    {...register("phoneNumber")}
                    aria-invalid={!!errors.phoneNumber}
                  />
                  {errors.phoneNumber ? <p className="text-body-sm text-destructive">{errors.phoneNumber.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-body-md text-[#111827]">
                    Destination city
                  </Label>
                  <div className="relative">
                    <select
                      id="city"
                      className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 pr-8 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-body-md"
                      {...register("city")}
                    >
                      {cities.length ? (
                        cities.map(c => (
                          <option key={c} value={formatCityLabel(c)}>
                            {formatCityLabel(c)}
                          </option>
                        ))
                      ) : (
                          <option value="" disabled>Select a city</option>
                      )}
                    </select>
                    <svg
                      aria-hidden="true"
                      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="township" className="text-body-md text-[#111827]">
                    Township
                  </Label>
                  <div className="relative">
                    <select
                      id="township"
                      className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 pr-8 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-body-md"
                      defaultValue=""
                      {...register("township")}
                    >
                      <option value="" disabled>
                        Select township
                      </option>
                      {townships.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <svg
                      aria-hidden="true"
                      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  {errors.township ? <p className="text-body-sm text-destructive">{errors.township.message}</p> : null}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryAddress" className="text-body-md text-[#111827]">
                  Delivery address
                </Label>
                <textarea
                  id="deliveryAddress"
                  placeholder="Building, street, ward or nearby landmark"
                  className="min-h-[88px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-body-md"
                  {...register("deliveryAddress")}
                />
                {errors.deliveryAddress ? <p className="text-body-sm text-destructive">{errors.deliveryAddress.message}</p> : null}
              </div>
            </section>

            <section className="space-y-5">
              <StepHeader number="02" title="Parcel & payment" subtitle="Add COD and handling information." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="weight" className="text-body-md text-[#111827]">
                    Weight
                  </Label>
                  <div className="relative">
                    <Input id="weight" type="number" step="0.1" className="pr-10" {...register("weight")} />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-body-md text-muted-foreground">
                      kg
                    </span>
                  </div>
                  {errors.weight ? <p className="text-body-sm text-destructive">{errors.weight.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codAmount" className="text-body-md text-[#111827]">
                    Cash on delivery (COD)
                  </Label>
                  <div className="relative">
                    <Input id="codAmount" type="number" className="pr-12" {...register("codAmount")} />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-body-md text-muted-foreground">
                      MMK
                    </span>
                  </div>
                  {errors.codAmount ? <p className="text-body-sm text-destructive">{errors.codAmount.message}</p> : null}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryNote" className="text-body-md text-[#111827]">
                  Delivery note
                </Label>
                <textarea
                  id="deliveryNote"
                  placeholder="Fragile, call before delivery..."
                  className="min-h-[88px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-body-md"
                  {...register("deliveryNote")}
                />
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="space-y-6 lg:col-span-4">
        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <StepHeader number="03" title="Delivery provider" subtitle={subtitle} />
          <div className="mt-4 space-y-2">
            {servicesError ? (
              <p className="text-body-sm text-destructive">Failed to load providers.</p>
            ) : services.length === 0 ? (
              <p className="text-body-sm text-[#6B7280]">No providers cover this city yet.</p>
            ) : (
              services.map(item => {
                const active = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setProviderId(item.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors",
                      active ? "border-[#10B981] bg-[#F0FDF4]" : "border-[#E5E7EB] bg-white hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-9 items-center justify-center rounded-full",
                          active ? "bg-white text-[#059669]" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Truck aria-hidden="true" className="size-4" />
                      </span>
                      <div>
                        <p className="text-body-md font-semibold text-[#111827]">{item.name}</p>
                        <p className="text-body-sm text-[#6B7280]">{cityValue}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-body-md font-bold text-[#111827]">{Number(item.fee).toLocaleString()} MMK</span>
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded-full border",
                          active ? "border-[#10B981] bg-[#10B981]" : "border-[#D1D5DB] bg-white",
                        )}
                      >
                        {active ? <span className="size-1.5 rounded-full bg-white" /> : null}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 text-[#059669]" />
            <div className="space-y-1">
              <p className="text-[13px] font-semibold text-[#065F46]">Private recipient information</p>
              <p className="text-[12px] leading-relaxed text-[#047857]">
                Recipient phone and full address are only visible to your workspace and assigned rider. Public tracking
                won&apos;t reveal these details.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-body-md">
              <span className="text-[#4B5563]">Delivery fee</span>
              <span className="font-medium text-[#111827]">{selected ? `${Number(selected.fee).toLocaleString()} MMK` : "0 MMK"}</span>
            </div>
            <div className="flex items-center justify-between text-body-md">
              <span className="text-[#4B5563]">Cash collection</span>
              <span className="font-medium text-[#111827]">0 MMK</span>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/seller")}
              className="h-auto flex-1 rounded-full border-[#E5E7EB] px-6 py-3 font-semibold text-[#111827]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selected}
              className="h-auto flex-1 gap-2 rounded-full bg-[#3D51A3] px-6 py-3 font-semibold text-white hover:bg-[#2F3F82]"
            >
              <Plus aria-hidden="true" className="size-4" />
              {isSubmitting ? "Creating..." : "Create parcel"}
            </Button>
          </div>
          <p className="mt-4 text-center text-[11px] text-[#9CA3AF]">Prototype only · Changes stay in this session</p>
        </section>
      </div>
    </form>
  );
}

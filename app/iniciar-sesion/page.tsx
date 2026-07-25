import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import AuthFlow from "@/app/components/AuthFlow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LoginPage() {
  noStore();
  return (
    <Suspense>
      <AuthFlow mode="login" />
    </Suspense>
  );
}

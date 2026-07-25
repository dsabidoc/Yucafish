import { Suspense } from "react";
import AuthFlow from "@/app/components/AuthFlow";

export default function LogoutPage() {
  return (
    <Suspense>
      <AuthFlow mode="logout" />
    </Suspense>
  );
}

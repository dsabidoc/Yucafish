import YucaFishApp from "@/app/components/YucaFishApp";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AppPage() {
  noStore();
  return <YucaFishApp />;
}

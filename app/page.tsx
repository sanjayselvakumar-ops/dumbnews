import { getDailyBrief } from "@/lib/news/brief";
import { DumbNewsApp } from "@/components/dumb-news-app";
import { RegisterServiceWorker } from "@/components/register-service-worker";

export const dynamic = "force-dynamic";

export default async function Page() {
  const brief = await getDailyBrief();

  return (
    <>
      <DumbNewsApp initialBrief={brief} />
      <RegisterServiceWorker />
    </>
  );
}

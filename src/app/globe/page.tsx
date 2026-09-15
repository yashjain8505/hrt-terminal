import { cookies } from "next/headers";
import { Header } from "@/components/Chrome";
import GlobeView from "@/components/GlobeView";
import { getProfile, getStats, getGlobeData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function GlobePage() {
  const profile = getProfile((await cookies()).get("hrt_profile")?.value);
  const stats = getStats();
  const { points, arcs, events } = getGlobeData(profile);
  return (
    <div className="flex flex-col min-h-screen">
      <Header profile={profile} stats={stats} />
      <main className="flex-1 p-[6px] min-h-0" style={{ height: "calc(100vh - 62px)" }}>
        <GlobeView points={points} arcs={arcs} events={events} profileName={profile.name} />
      </main>
    </div>
  );
}

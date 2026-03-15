import { LoaderIcon } from "lucide-react";
import { useEffect, useState } from "react";
import ConstellationView from "@/components/ConstellationView";
import useCurrentUser from "@/hooks/useCurrentUser";
import { memoServiceClient } from "@/grpcweb";
import { State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";

const FETCH_PAGE_SIZE = 50;

const Constellation = () => {
  const currentUser = useCurrentUser();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const loadAllMemos = async () => {
      setLoading(true);
      const allMemos: Memo[] = [];
      let pageToken = "";

      try {
        do {
          const response = await memoServiceClient.listMemos({
            parent: currentUser.name,
            state: State.NORMAL,
            pageSize: FETCH_PAGE_SIZE,
            pageToken,
          });
          allMemos.push(...response.memos);
          pageToken = response.nextPageToken;
        } while (pageToken);
      } catch (error) {
        console.error("Failed to load memos for constellation:", error);
      }

      setMemos(allMemos);
      setLoading(false);
    };

    loadAllMemos();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="w-full h-[calc(100vh-48px)] flex items-center justify-center constellation-bg rounded-xl">
        <div className="flex flex-col items-center gap-3">
          <LoaderIcon className="animate-spin text-slate-400 w-8 h-8" />
          <p className="text-slate-500 text-sm">Charting the stars...</p>
        </div>
      </div>
    );
  }

  if (memos.length === 0) {
    return (
      <div className="w-full h-[calc(100vh-48px)] flex items-center justify-center constellation-bg rounded-xl">
        <div className="flex flex-col items-center gap-3">
          <p className="text-slate-400 text-lg">No stars yet</p>
          <p className="text-slate-600 text-sm">Create some memos to see your constellation!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-48px)]">
      <ConstellationView memos={memos} fullScreen />
    </div>
  );
};

export default Constellation;

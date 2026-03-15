import { Memo } from "@/types/proto/api/v1/memo_service";

export interface ConstellationNode {
  id: string; // memo.name
  memo: Memo;
  size: number;
  brightness: number;
  color: string;
  tags: string[];
}

export interface ConstellationLink {
  source: string;
  target: string;
}

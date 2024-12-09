export interface Space {
  id: string;
  name: string;
  destinationFolder: string;
  enabledTags: string[];
  pendingSubmissions?: number;
  isDownloading?: boolean;
  isRefreshing?: boolean;
  copyButtonText?: string;
}

export interface NewSpace {
  id: string | null;
  name: string;
  destinationFolder: string;
  enabledTags: string[];
  _manuallyModifiedDestination?: boolean;
}
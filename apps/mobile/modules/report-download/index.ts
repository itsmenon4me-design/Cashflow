import { requireOptionalNativeModule } from "expo-modules-core";

type ReportDownloadsModule = {
  saveToDownloads(
    base64: string,
    filename: string,
    mimeType: string,
  ): Promise<void>;
};

export default requireOptionalNativeModule<ReportDownloadsModule>("ReportDownloads");

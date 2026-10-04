import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import type { NativeReportExport } from "./api-client";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type NativeReportExportResult = "saved" | "cancelled" | "shared";

export async function saveNativeReportExport(
  report: NativeReportExport,
): Promise<NativeReportExportResult> {
  if (
    !report.content ||
    !report.filename.toLowerCase().endsWith(".xlsx") ||
    report.filename.includes("/") ||
    report.filename.includes("\\") ||
    report.contentEncoding !== "base64" ||
    report.contentType !== XLSX_CONTENT_TYPE
  ) {
    throw new Error("The server returned an invalid Excel report file.");
  }

  if (Platform.OS === "android" && Number(Platform.Version) >= 30) {
    const permission =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) return "cancelled";

    const fileName = report.filename.slice(0, -".xlsx".length);
    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      fileName,
      XLSX_CONTENT_TYPE,
    );
    await FileSystem.writeAsStringAsync(fileUri, report.content, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return "saved";
  }

  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new Error("Excel report export is only available on native devices.");
  }

  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) {
    throw new Error("The app could not access its temporary file directory.");
  }

  const fileUri = `${cacheDirectory}${report.filename}`;
  await FileSystem.writeAsStringAsync(fileUri, report.content, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("The system share sheet is not available.");
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: XLSX_CONTENT_TYPE,
    dialogTitle: report.filename,
    UTI: "org.openxmlformats.spreadsheetml.sheet",
  });
  return "shared";
}

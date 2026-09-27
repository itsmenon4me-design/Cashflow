import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/axios";
import { downloadExport, reportService } from "./report.service";

vi.mock("@/lib/axios", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockedGet = apiClient.get as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("report.service export", () => {
  it("sends the complete selected range for XLSX export", async () => {
    mockedGet.mockResolvedValue({
      filename: "report.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content: "UEsDBAo=",
      contentEncoding: "base64",
    });
    const range = {
      startDate: "2026-08-01T00:00:00.000Z",
      endDate: "2026-08-31T23:59:59.999Z",
    };

    await reportService.exportReport({
      type: "monthly",
      format: "xlsx",
      ...range,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/reports/export", {
      params: {
        type: "monthly",
        format: "xlsx",
        month: undefined,
        year: undefined,
        ...range,
      },
    });
  });

  it("decodes base64 workbook bytes before creating the download", async () => {
    const blobs: Blob[] = [];
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        blobs.push(blob);
        return "blob:report";
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const appendChild = vi.spyOn(document.body, "appendChild");

    try {
      downloadExport({
        filename: "report.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        content: "UEsDBAo=",
        contentEncoding: "base64",
      });

      const anchor = appendChild.mock.calls[0][0] as HTMLAnchorElement;
      expect(anchor.download).toBe("report.xlsx");
      expect(click).toHaveBeenCalledOnce();
      expect(blobs).toHaveLength(1);
      expect(blobs[0].type).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      const bytes = await new Promise<number[]>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(Array.from(new Uint8Array(reader.result)));
          } else {
            reject(new Error("Blob did not produce binary data"));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blobs[0]);
      });
      expect(bytes).toEqual([0x50, 0x4b, 0x03, 0x04, 0x0a]);
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectURL,
      });
    }
  });
});

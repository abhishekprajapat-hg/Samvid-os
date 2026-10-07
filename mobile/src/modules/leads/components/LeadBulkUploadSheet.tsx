import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import { AppSheet } from "../../../components/ui/Overlay";
import { Banner, BrandButton, Chip, ChipRow } from "../../../components/brand/kit";
import { brand, brandStyles, round, type as t } from "../../../theme/brand";
import { bulkUploadLeads } from "../../../services/leadService";
import { toErrorMessage } from "../../../utils/errorMessage";
import {
  parseBulkLeadCsvRows,
  parseBulkLeadRowsFromMatrix,
  shouldSkipWorkbookSheet,
  type BulkLeadRow,
} from "../bulkLeadUpload";

/*
 * Bulk upload - web's BulkLeadUploadModal and its two handlers.
 *
 * A CSV is read as text, as web reads it; an .xlsx is read through the same
 * SheetJS library web uses, every sheet except the ones web skips. Pasting CSV
 * works too, which is how web's modal starts. The rows are web's rows exactly
 * (bulkLeadUpload.ts is a port), sent to the same POST /leads/bulk.
 *
 * The September plan left this on the desk. It is here now because every web
 * feature is: a sheet forwarded on WhatsApp is on the phone already.
 */

export const LeadBulkUploadSheet = ({
  visible,
  sheetTypes,
  onClose,
  onUploaded,
}: {
  visible: boolean;
  sheetTypes: Array<{ label: string; value: string }>;
  onClose: () => void;
  onUploaded: (summary: string) => void;
}) => {
  const [sheetType, setSheetType] = useState(sheetTypes[0]?.value || "COMMERCIAL");
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<BulkLeadRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!sheetTypes.some((option) => option.value === sheetType)) setSheetType(sheetTypes[0]?.value || "COMMERCIAL");
  }, [sheetType, sheetTypes]);

  const reset = () => {
    setCsvText("");
    setParsedRows(null);
    setFileName("");
    setError("");
  };

  const pickFile = async () => {
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const extension = String(asset.name || "").split(".").pop()?.toLowerCase();

      if (extension === "xlsx" || extension === "xls") {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        const workbook = XLSX.read(base64, { type: "base64", cellDates: true });
        const rows: BulkLeadRow[] = [];
        workbook.SheetNames.forEach((sheetName) => {
          if (shouldSkipWorkbookSheet(sheetName)) return;
          const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
            header: 1,
            defval: "",
            blankrows: false,
            raw: false,
          });
          rows.push(...parseBulkLeadRowsFromMatrix({ matrix, sheetName, sheetType }));
        });
        if (!rows.length) throw new Error("No valid lead rows found in workbook");
        setParsedRows(rows);
        setCsvText(`Parsed ${rows.length} lead rows from ${asset.name}`);
      } else {
        const text = await FileSystem.readAsStringAsync(asset.uri);
        setParsedRows(null);
        setCsvText(String(text || ""));
      }
      setFileName(String(asset.name || ""));
    } catch (e) {
      setParsedRows(null);
      setError(toErrorMessage(e, "Unable to read selected bulk lead file"));
    }
  };

  const upload = async () => {
    setUploading(true);
    setError("");
    try {
      const rows = parsedRows || parseBulkLeadCsvRows(csvText, sheetType);
      const result = await bulkUploadLeads(rows as unknown as Record<string, unknown>[]);
      const created = Number(result?.createdCount || 0);
      const updated = Number(result?.updatedCount || 0);
      const failed = Number(result?.failedCount || 0);
      const summary = `Bulk upload complete: ${created} created, ${updated} updated, ${failed} failed`;
      const failures = Array.isArray(result?.failures) ? result.failures : [];
      if (failed > 0 && failures.length) {
        const preview = failures
          .slice(0, 5)
          .map((failure: { row?: number; message?: string }) => `Row ${failure.row}: ${failure.message}`)
          .join(" | ");
        setError(failures.length > 5 ? `Some rows failed. ${preview} | ...` : `Some rows failed. ${preview}`);
        onUploaded(summary);
      } else {
        reset();
        onUploaded(summary);
        onClose();
      }
    } catch (e) {
      setError(toErrorMessage(e, "Failed to bulk upload leads"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Bulk upload leads"
      subtitle="CSV or Excel. Needs at least a name and a phone column."
      footer={
        <View style={styles.footer}>
          <BrandButton title="Cancel" variant="secondary" style={styles.flex} onPress={onClose} />
          <BrandButton
            title={uploading ? "Uploading…" : "Upload"}
            icon="cloud-upload-outline"
            style={styles.flex}
            loading={uploading}
            disabled={uploading || (!parsedRows && !csvText.trim())}
            onPress={upload}
          />
        </View>
      }
    >
      {sheetTypes.length > 1 ? (
        <>
          <Text style={styles.label}>Sheet type</Text>
          <ChipRow wrap>
            {sheetTypes.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={sheetType === option.value}
                onPress={() => {
                  setSheetType(option.value);
                  setParsedRows(null);
                  if (fileName) {
                    setCsvText("");
                    setFileName("");
                  }
                }}
              />
            ))}
          </ChipRow>
        </>
      ) : null}

      <View style={styles.fileRow}>
        <BrandButton title="Choose file" icon="document-attach-outline" variant="secondary" onPress={pickFile} />
        <Text style={styles.fileName} numberOfLines={1}>
          {fileName || "No file chosen"}
        </Text>
      </View>

      <Text style={styles.label}>Or paste CSV</Text>
      <TextInput
        style={styles.textarea}
        value={csvText}
        onChangeText={(value) => {
          setParsedRows(null);
          setCsvText(value);
        }}
        placeholder={"name,phone,email,city,project\nRavi,9876543210,ravi@example.com,Indore,Skye Tower"}
        placeholderTextColor={brand.placeholder}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error ? <Banner tone="alert" message={error} style={styles.gap} /> : null}
    </AppSheet>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    flex: { flex: 1 },
    footer: { flexDirection: "row", gap: 8 },
    gap: { marginTop: 10 },
    label: { marginTop: 12, marginBottom: 7, fontSize: t.fieldLabel, fontWeight: "600", color: b.text },
    fileRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
    fileName: { flex: 1, fontSize: t.label, color: b.textMuted },
    textarea: {
      minHeight: 130,
      padding: 10,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
      fontSize: 12,
      color: b.text,
      backgroundColor: b.surface,
      textAlignVertical: "top",
    },
  }),
);

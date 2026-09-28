import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Glyph } from "../../../components/ui/Glyph";
import { BrandButton } from "../../../components/brand/kit";
import { brand, brandStyles, round, type as t } from "../../../theme/brand";
import { openLocalFile } from "../../../utils/shareFile";
import type { ClientDocument } from "../boardReducer";
import {
  ACCEPTED_MIME_TYPES,
  MAX_FILE_BYTES,
  attachFile,
  documentsFor,
  forgetFile,
  formatBytes,
  kycStatusOf,
  localFileFor,
  type DocumentSpec,
  type PickedFile,
} from "../kycDocuments";

/*
 * The KYC checklist, used while onboarding and afterwards on the client's
 * profile - web's DocumentChecklist.jsx.
 *
 * It never blocks. A desk that cannot let a cabin until the last scan arrives
 * will take the papers on paper and stop using the screen, and then nobody
 * knows what is missing. So the list states what is outstanding, and chasing it
 * is a visible job rather than a forgotten one.
 *
 * A phone adds one thing web does not need: the camera. Most of these papers
 * are handed over across a desk, so "Scan" photographs the document directly
 * rather than making someone scan it elsewhere and then find the file.
 */

const isImage = (doc: ClientDocument) =>
  String(doc.type || "").startsWith("image/") || /\.(png|jpe?g)$/i.test(String(doc.fileName || ""));

const DocumentRow = ({
  spec,
  uploaded,
  readOnly,
  onUpload,
  onRemove,
}: {
  spec: DocumentSpec;
  uploaded?: ClientDocument;
  readOnly?: boolean;
  onUpload: (spec: DocumentSpec, source: "file" | "camera") => void;
  onRemove: (spec: DocumentSpec) => void;
}) => {
  const [localUri, setLocalUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLocalUri(null);
    if (uploaded) {
      localFileFor(uploaded).then((uri) => {
        if (active) setLocalUri(uri);
      });
    }
    return () => {
      active = false;
    };
  }, [uploaded?.id]);

  return (
    <View
      style={[
        styles.row,
        uploaded ? styles.rowDone : spec.required ? null : styles.rowOptional,
      ]}
    >
      <View style={styles.rowHead}>
        <View style={[styles.check, uploaded && styles.checkDone]}>
          <Glyph name={uploaded ? "checkmark" : "attach"} size={12} color={uploaded ? brand.onPrimary : brand.textMuted} />
        </View>
        <View style={styles.rowText}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowTitle}>{spec.label}</Text>
            {spec.required ? (
              <Text style={styles.required}>REQUIRED</Text>
            ) : (
              <Text style={styles.optional}>Optional</Text>
            )}
          </View>
          {spec.hint ? <Text style={styles.hint}>{spec.hint}</Text> : null}
          {uploaded ? (
            <View style={styles.fileLine}>
              <Text style={styles.fileName} numberOfLines={1}>
                {uploaded.fileName}
              </Text>
              <Text style={styles.fileSize}>{formatBytes(uploaded.size)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {uploaded && localUri && isImage(uploaded) ? (
        <Pressable onPress={() => openLocalFile(localUri, uploaded.type)} accessibilityLabel={`Open ${uploaded.fileName}`}>
          <Image source={{ uri: localUri }} style={styles.preview} resizeMode="contain" />
        </Pressable>
      ) : null}

      {uploaded ? (
        <View style={styles.actions}>
          {localUri ? (
            <BrandButton
              title="Open"
              icon="eye-outline"
              size="sm"
              variant="secondary"
              onPress={() => openLocalFile(localUri, uploaded.type)}
            />
          ) : (
            <Text style={styles.remoteNote}>Attached on another device</Text>
          )}
          {!readOnly ? (
            <>
              <BrandButton title="Replace" icon="cloud-upload-outline" size="sm" variant="ghost" onPress={() => onUpload(spec, "file")} />
              <BrandButton title="Remove" icon="trash-outline" size="sm" variant="dangerSoft" onPress={() => onRemove(spec)} />
            </>
          ) : null}
        </View>
      ) : !readOnly ? (
        <View style={styles.actions}>
          <BrandButton title="Upload" icon="cloud-upload-outline" size="sm" variant="secondary" onPress={() => onUpload(spec, "file")} />
          <BrandButton title="Scan" icon="camera-outline" size="sm" variant="secondary" onPress={() => onUpload(spec, "camera")} />
        </View>
      ) : null}
    </View>
  );
};

export const DocumentChecklist = ({
  kind,
  documents,
  onChange,
  readOnly,
}: {
  kind?: string;
  documents: ClientDocument[];
  onChange?: (next: ClientDocument[]) => void;
  readOnly?: boolean;
}) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const set = documentsFor(kind);
  const status = kycStatusOf({ kind, documents });
  const byKey = new Map(documents.map((doc) => [doc.key, doc]));

  const pick = async (source: "file" | "camera"): Promise<PickedFile | null> => {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setMessage("Camera permission is off. Turn it on in Settings, or upload a file instead.");
        return null;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ["images"] });
      if (result.canceled || !result.assets?.[0]) return null;
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        name: asset.fileName || `scan-${Date.now()}.jpg`,
        size: Number(asset.fileSize || 0),
        mimeType: asset.mimeType || "image/jpeg",
      };
    }
    const result = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_MIME_TYPES, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.name,
      size: Number(asset.size || 0),
      mimeType: asset.mimeType || "application/octet-stream",
    };
  };

  const upload = async (spec: DocumentSpec, source: "file" | "camera") => {
    if (busy || !onChange) return;
    const file = await pick(source);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setMessage(`${formatBytes(file.size)} is over the ${formatBytes(MAX_FILE_BYTES)} limit.`);
      return;
    }
    setBusy(true);
    try {
      const attached = await attachFile(spec, file);
      const existing = byKey.get(spec.key);
      if (existing) forgetFile(existing);
      onChange([...documents.filter((item) => item.key !== spec.key), attached]);
      setMessage(`${spec.label} attached. Check the date of birth against it if it carries one.`);
    } finally {
      setBusy(false);
    }
  };

  const remove = (spec: DocumentSpec) => {
    if (!onChange) return;
    const existing = byKey.get(spec.key);
    if (existing) forgetFile(existing);
    onChange(documents.filter((item) => item.key !== spec.key));
  };

  return (
    <View style={styles.root}>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={[styles.summary, status.complete ? styles.summaryDone : styles.summaryDue]}>
        <View style={[styles.summaryIcon, { backgroundColor: status.complete ? brand.primary : brand.warning }]}>
          <Glyph name={status.complete ? "checkmark" : "alert"} size={13} color={brand.onPrimary} />
        </View>
        <View style={styles.summaryText}>
          <Text style={[styles.summaryTitle, { color: status.complete ? brand.deep : brand.warnInk }]}>
            {status.complete ? "KYC complete" : `${status.uploaded} of ${status.required} required documents`}
          </Text>
          {!status.complete ? (
            <Text style={[styles.summaryMissing, { color: brand.warnInk }]}>
              Still needed: {status.missing.map((doc) => doc.label).join(", ")}.
            </Text>
          ) : null}
        </View>
      </View>

      {set.map((spec) => (
        <DocumentRow
          key={`${spec.key}:${byKey.get(spec.key)?.id || "missing"}`}
          spec={spec}
          uploaded={byKey.get(spec.key)}
          readOnly={readOnly || busy || !onChange}
          onUpload={upload}
          onRemove={remove}
        />
      ))}
    </View>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: { gap: 8 },
    message: { fontSize: t.label, lineHeight: 16, color: b.infoInk },
    summary: { flexDirection: "row", gap: 9, padding: 10, borderRadius: round.field },
    summaryDone: { backgroundColor: b.tint },
    summaryDue: { backgroundColor: b.warnTint },
    summaryIcon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    summaryText: { flex: 1, minWidth: 0, gap: 2 },
    summaryTitle: { fontSize: t.body, fontWeight: "700" },
    summaryMissing: { fontSize: t.label, lineHeight: 15 },

    row: {
      gap: 8,
      padding: 10,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    rowDone: { borderColor: b.track, backgroundColor: b.uploadTint },
    rowOptional: { borderStyle: "dashed" },
    rowHead: { flexDirection: "row", gap: 9 },
    check: {
      width: 20,
      height: 20,
      marginTop: 1,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.fieldBorder,
    },
    checkDone: { backgroundColor: b.primary, borderColor: b.primary },
    rowText: { flex: 1, minWidth: 0, gap: 2 },
    rowTitleLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
    rowTitle: { fontSize: t.body, fontWeight: "600", color: b.text },
    required: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.fieldMuted,
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 0.4,
      color: b.textMuted,
    },
    optional: { fontSize: 10.5, color: b.placeholder },
    hint: { fontSize: t.label, color: b.textMuted },
    fileLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 3 },
    fileName: { flexShrink: 1, fontSize: t.label, fontWeight: "600", color: b.textSecondary },
    fileSize: { fontSize: t.label, color: b.placeholder },
    preview: {
      width: "100%",
      height: 140,
      borderRadius: round.field,
      borderWidth: 1,
      borderColor: b.border,
      backgroundColor: b.surface,
    },
    actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
    remoteNote: { fontSize: t.label, color: b.textMuted, fontStyle: "italic" },
  }),
);

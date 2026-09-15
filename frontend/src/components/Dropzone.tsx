import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { UploadFileParam } from '../services/api';

interface DropzoneProps {
  onFileSelect: (fileParam: UploadFileParam) => void;
  isLoading: boolean;
  selectedFile: UploadFileParam | null;
  onClear: () => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelect,
  isLoading,
  selectedFile,
  onClear,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleWebFileChange = (e: any) => {
    const files = e.target?.files;
    if (files && files[0]) {
      const f = files[0];
      onFileSelect({
        file: f,
        name: f.name,
        type: f.type || 'application/pdf',
      });
    }
  };

  const handleWebDrop = (e: any) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      onFileSelect({
        file: f,
        name: f.name,
        type: f.type || 'application/pdf',
      });
    }
  };

  const pickDocumentMobile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        onFileSelect({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/pdf',
          file: (asset as any).file,
        });
      }
    } catch (err) {
      console.error('Error picking document:', err);
    }
  };

  const pickImageMobile = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        alert('Permission to access photos is required.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        const name = asset.fileName || `lab_photo_${Date.now()}.jpg`;
        onFileSelect({
          uri: asset.uri,
          name: name,
          type: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (err) {
      console.error('Error picking image:', err);
    }
  };

  return (
    <View style={styles.card}>
      {/* Hidden Web file input */}
      {Platform.OS === 'web' && (
        <input
          type="file"
          ref={fileInputRef as any}
          style={{ display: 'none' }}
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={handleWebFileChange}
        />
      )}

      {selectedFile ? (
        <View style={styles.selectedContainer}>
          <View style={styles.fileIconWrapper}>
            <MaterialCommunityIcons
              name={selectedFile.name.endsWith('.pdf') ? 'file-pdf-box' : 'file-image'}
              size={36}
              color="#2563EB"
            />
          </View>
          <View style={styles.selectedDetails}>
            <Text style={styles.selectedFileName} numberOfLines={1}>
              {selectedFile.name}
            </Text>
            <Text style={styles.selectedFileType}>
              {selectedFile.type}
            </Text>
          </View>

          {!isLoading && (
            <TouchableOpacity onPress={onClear} style={styles.clearButton}>
              <MaterialCommunityIcons name="close-circle-outline" size={24} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View
          style={[
            styles.dropArea,
            isDragOver && styles.dropAreaActive,
          ]}
          // Web drag events
          {...(Platform.OS === 'web'
            ? {
                onDragOver: (e: any) => {
                  e.preventDefault();
                  setIsDragOver(true);
                },
                onDragLeave: () => setIsDragOver(false),
                onDrop: handleWebDrop,
              }
            : {})}
        >
          <View style={styles.uploadIconCircle}>
            <MaterialCommunityIcons name="cloud-upload" size={32} color="#2563EB" />
          </View>

          <Text style={styles.dropMainText}>
            {Platform.OS === 'web'
              ? 'Drag & drop your lab report here'
              : 'Upload a blood test report'}
          </Text>
          <Text style={styles.dropSubText}>Supports PDF documents and JPEG/PNG images</Text>

          <View style={styles.buttonRow}>
            {Platform.OS === 'web' ? (
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <MaterialCommunityIcons name="folder-outline" size={18} color="#FFFFFF" />
                <Text style={styles.browseButtonText}>Browse Files</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.browseButton}
                  onPress={pickDocumentMobile}
                  disabled={isLoading}
                >
                  <MaterialCommunityIcons name="file-document-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.browseButtonText}>Choose Document</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.browseButton, styles.cameraButton]}
                  onPress={pickImageMobile}
                  disabled={isLoading}
                >
                  <MaterialCommunityIcons name="camera-outline" size={18} color="#2563EB" />
                  <Text style={[styles.browseButtonText, styles.cameraButtonText]}>Photo Library</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Extracting biomarkers & analyzing report...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  dropArea: {
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  dropAreaActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  uploadIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dropMainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  dropSubText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 18,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  cameraButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  cameraButtonText: {
    color: '#2563EB',
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fileIconWrapper: {
    marginRight: 14,
  },
  selectedDetails: {
    flex: 1,
  },
  selectedFileName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  selectedFileType: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
    marginTop: 10,
  },
});


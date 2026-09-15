import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { Header, TabType } from './src/components/Header';
import { ArchiveScreen } from './src/screens/ArchiveScreen';
import { TrendsScreen } from './src/screens/TrendsScreen';
import { UploadScreen } from './src/screens/UploadScreen';
import { listLabDocuments } from './src/services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [existingFilenames, setExistingFilenames] = useState<string[]>([]);
  const [selectedBiomarkerForTrends, setSelectedBiomarkerForTrends] = useState<string | undefined>(
    undefined
  );
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    loadExistingDocuments();
  }, [refreshTrigger]);

  const loadExistingDocuments = async () => {
    try {
      const docs = await listLabDocuments();
      setExistingFilenames(docs.map((d) => d.filename));
    } catch (err) {
      console.error('Failed to load existing document names:', err);
    }
  };

  const handleUploadSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleNavigateToTrends = (biomarkerName?: string) => {
    if (biomarkerName) {
      setSelectedBiomarkerForTrends(biomarkerName);
    }
    setActiveTab('trends');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        <Header activeTab={activeTab} onTabChange={setActiveTab} />

        <View style={styles.content}>
          {activeTab === 'upload' && (
            <UploadScreen
              onNavigateToTrends={handleNavigateToTrends}
              existingFilenames={existingFilenames}
              onUploadSuccess={handleUploadSuccess}
            />
          )}

          {activeTab === 'trends' && (
            <TrendsScreen initialBiomarker={selectedBiomarkerForTrends} />
          )}

          {activeTab === 'archive' && (
            <ArchiveScreen
              onSelectBiomarker={handleNavigateToTrends}
              refreshTrigger={refreshTrigger}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
});


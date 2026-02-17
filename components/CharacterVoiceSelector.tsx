import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { getAvailableVoices } from '@/services/tts';
import { buildCharacterOptions, CharacterOption } from '@/lib/characterVoices';

type Props = {
  selectedVoiceId?: string | undefined; // the parent's selected voice identifier (for functional use)
  selectedCharacter?: string | undefined; // the parent's selected character name (for visuals)
  onSelect: (selection: { character: string; voiceIdentifier?: string; pitch: number; rate: number; subtitle?: string }) => void;
};

export default function CharacterVoiceSelector({ selectedVoiceId, selectedCharacter, onSelect }: Props) {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<CharacterOption[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const voices: Speech.Voice[] = await getAvailableVoices();
        const chars = buildCharacterOptions(voices);
        if (!mounted) return;
        setOptions(chars);
      } catch (e) {
        console.error('CharacterVoiceSelector: failed to load voices', e);
        if (!mounted) return;
        setOptions(buildCharacterOptions([]));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handlePress = (opt: CharacterOption | null) => {
    if (!opt) {
      // Default (system)
      onSelect({ character: 'Default', voiceIdentifier: undefined, pitch: 1.0, rate: 1.0, subtitle: undefined });
      return;
    }
    onSelect({ character: opt.character, voiceIdentifier: opt.voiceIdentifier, pitch: opt.pitch, rate: opt.rate, subtitle: opt.subtitle });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return (
    <FlatList
      data={[null, ...options]} // null represents Default
      keyExtractor={(item) => (item ? item.character : 'default')}
      extraData={[selectedVoiceId, selectedCharacter]}
      renderItem={({ item }) => {
        const label = item ? item.character : 'Default';
        // Visual selection is based on the parent's selectedCharacter so rows
        // remain unique even if multiple characters map to the same system voice.
        const isSelected = item ? (selectedCharacter ? item.character === selectedCharacter : false) : (selectedCharacter === 'Default');
        return (
          <TouchableOpacity
            style={[styles.item, isSelected && styles.itemSelected]}
            onPress={() => handlePress(item)}
          >
            <View style={styles.row}>
              <View style={[styles.accentBar, isSelected && styles.accentBarVisible]} />
              <View style={styles.labelWrap}>
                <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>{label}</Text>
                <Text style={styles.itemSubtitle}>{item?.subtitle ?? ''}</Text>
              </View>
              <View style={styles.checkWrap}>
                {isSelected && <Check size={20} color={isSelected ? '#60A5FA' : '#fff'} />}
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  item: {
    paddingVertical: 18,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'transparent',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  accentBar: { width: 6, height: '100%', backgroundColor: 'transparent', borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  accentBarVisible: { backgroundColor: '#60A5FA' },
  labelWrap: { flex: 1, paddingVertical: 2, paddingHorizontal: 16 },
  checkWrap: { width: 36, alignItems: 'center', justifyContent: 'center' },
  itemSelected: { backgroundColor: '#0B1220' },
  itemText: { fontSize: 18, color: '#FFFFFF', fontWeight: '600' },
  itemTextSelected: { color: '#60A5FA', fontWeight: '700' },
  itemSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
});

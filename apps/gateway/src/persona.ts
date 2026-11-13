import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Persona } from '@companion/core';

const CONFIG_DIR = resolve(process.cwd(), '../../config');

interface AssistantConfig {
  name: string;
  language: string;
  voiceId: string;
  avatarUrl?: string;
  defaultMood?: string;
}

export async function loadPersona(): Promise<Persona & { avatarUrl?: string; defaultMood?: string }> {
  let personaMd = '';
  let assistantCfg: AssistantConfig = {
    name: 'Nova',
    language: 'en-IN',
    voiceId: process.env['VOICE_ID'] ?? 'alloy',
  };

  try {
    personaMd = await readFile(resolve(CONFIG_DIR, 'persona.md'), 'utf-8');
  } catch {
    personaMd = `You are Nova, a helpful personal AI assistant. You are concise, friendly, and speak in plain sentences.`;
  }

  try {
    const raw = await readFile(resolve(CONFIG_DIR, 'assistant.json'), 'utf-8');
    assistantCfg = JSON.parse(raw) as AssistantConfig;
  } catch {
    // Use defaults
  }

  // VOICE_ID env var always wins over assistant.json (lets user override without editing JSON)
  const voiceId = process.env['VOICE_ID'] ?? assistantCfg.voiceId;

  return {
    name: assistantCfg.name,
    voiceId,
    language: assistantCfg.language,
    systemPrompt: personaMd,
    avatarUrl: assistantCfg.avatarUrl,
    defaultMood: assistantCfg.defaultMood,
  };
}


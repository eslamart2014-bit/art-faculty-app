import { SupabaseClient } from '@supabase/supabase-js';

export const setBotState = async (supabase: SupabaseClient, chatId: string, state: string, payload: any = {}) => {
  await supabase.from('telegram_bot_states').upsert({
    chat_id: chatId.toString(),
    state,
    payload,
    created_at: new Date().toISOString()
  });
};

export const getBotState = async (supabase: SupabaseClient, chatId: string) => {
  const { data } = await supabase.from('telegram_bot_states').select('*').eq('chat_id', chatId.toString()).maybeSingle();
  return data;
};

export const clearBotState = async (supabase: SupabaseClient, chatId: string) => {
  await supabase.from('telegram_bot_states').delete().eq('chat_id', chatId.toString());
};

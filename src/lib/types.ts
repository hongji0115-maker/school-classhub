export interface Room {
  id: string;
  pin_code: string;
  title: string;
  description: string;
  room_type: 'board' | 'quiz';
  status: 'active' | 'ended';
  settings: {
    columns?: string[];
    bgm?: boolean;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface BoardPost {
  id: string;
  room_id: string;
  author_name: string;
  content: string;
  column_name: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'white';
  image_url?: string | null;
  likes_count: number;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  room_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  time_limit_sec: number;
  points: number;
  order_idx: number;
  explanation: string;
  created_at: string;
}

export interface QuizSession {
  id: string;
  room_id: string;
  current_question_idx: number; // -1: lobby, 0..N: question, 999: finished
  state: 'lobby' | 'question' | 'revealing' | 'leaderboard' | 'finished';
  question_started_at: string | null;
  updated_at: string;
}

export interface QuizParticipant {
  id: string;
  room_id: string;
  nickname: string;
  score: number;
  streak: number;
  last_answered_idx: number;
  joined_at: string;
}

export interface QuizAnswer {
  id: string;
  room_id: string;
  question_id: string;
  participant_id: string;
  selected_option: number;
  is_correct: boolean;
  score_awarded: number;
  answered_at: string;
}

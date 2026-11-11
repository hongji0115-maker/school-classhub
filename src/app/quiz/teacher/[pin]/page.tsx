import QuizTeacherView from '@/components/QuizTeacherView';

export function generateStaticParams() {
  return [
    { pin: '111111' },
    { pin: '222222' },
    { pin: 'demo' },
  ];
}

export default function QuizTeacherPinPage() {
  return <QuizTeacherView />;
}

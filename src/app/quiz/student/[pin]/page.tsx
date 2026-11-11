import QuizStudentView from '@/components/QuizStudentView';

export function generateStaticParams() {
  return [
    { pin: '111111' },
    { pin: '222222' },
    { pin: 'demo' },
  ];
}

export default function QuizStudentPinPage() {
  return <QuizStudentView />;
}

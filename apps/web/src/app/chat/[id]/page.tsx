import { ConversationView } from './ConversationView';

export default function ConversationPage({
  params,
}: {
  params: { id: string };
}) {
  return <ConversationView params={params} />;
}

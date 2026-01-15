import { NotificationInbox } from "@/components/NotificationInbox";

const Index = () => {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-md h-[700px]">
        <NotificationInbox />
      </div>
    </div>
  );
};

export default Index;

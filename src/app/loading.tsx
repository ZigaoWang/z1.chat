export default function Loading() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="flex gap-1">
        <span className="h-2 w-2 rounded-full bg-primary/40 animate-[bounce_1.4s_ease-in-out_infinite]" />
        <span className="h-2 w-2 rounded-full bg-primary/40 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
        <span className="h-2 w-2 rounded-full bg-primary/40 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
      </div>
    </div>
  );
}

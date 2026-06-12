interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions, icon }: PageHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-6 shrink-0"
      style={{
        height: 72,
        background: "#FFFFFF",
        borderBottom: "1px solid #E5E7EB",
      }}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0"
            style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}
          >
            {icon}
          </div>
        )}
        <div>
          <h1
            className="text-[16px] font-semibold"
            style={{ color: "#111827", letterSpacing: "-0.01em" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

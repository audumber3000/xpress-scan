import React from "react";
import { MoreVertical } from "lucide-react";

const Card = ({ title, value, change, changeType, menu, children }) => (
  <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-2 relative min-w-0">
    <div className="flex items-start justify-between w-full">
      <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
        {title}
      </div>
      {menu !== false && (
        <button className="text-gray-400 hover:text-gray-600 p-1 rounded-full">
          <MoreVertical className="w-4 h-4" />
        </button>
      )}
    </div>
    {value !== undefined && (
      <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
    )}
    {change && (
      <div className="flex items-center gap-1 text-xs">
        <span className={changeType === "up" ? "text-[#6C4CF3]" : "text-red-500"}>
          {changeType === "up" ? "▲" : "▼"} {change}
        </span>
      </div>
    )}
    {children}
  </div>
);

export default Card; 
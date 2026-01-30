import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeader } from '../contexts/HeaderContext';
import { 
  Calendar, 
  Users, 
  DollarSign, 
  Monitor, 
  Settings, 
  Lock,
  Briefcase,
  Building2,
  MessageSquare,
  UserPlus
} from 'lucide-react';

const AdminHub = () => {
  const navigate = useNavigate();
  const { setTitle } = useHeader();
  
  React.useEffect(() => {
    setTitle && setTitle('Admin Hub');
  }, [setTitle]);

  const adminSections = [
    {
      title: 'Daily Admin',
      modules: [
        {
          id: 'attendance',
          title: 'Attendance',
          icon: Calendar,
          iconColor: '#2D9596',
          backgroundColor: '#E0F2F2',
          path: '/admin/attendance'
        },
        {
          id: 'staff',
          title: 'Staff',
          icon: Users,
          iconColor: '#2D9596',
          backgroundColor: '#E0F2F2',
          path: '/admin/staff'
        },
        {
          id: 'clinic',
          title: 'Clinic Info',
          icon: Building2,
          iconColor: '#2D9596',
          backgroundColor: '#E0F2F2',
          path: '/admin/clinic'
        }
      ]
    },
    {
      title: 'Billing & Finance',
      modules: [
        {
          id: 'treatments',
          title: 'Treatments',
          icon: DollarSign,
          iconColor: '#10B981',
          backgroundColor: '#D1FAE5',
          path: '/admin/treatments'
        },
        {
          id: 'subscription',
          title: 'Subscription',
          icon: Monitor,
          iconColor: '#8B5CF6',
          backgroundColor: '#EDE9FE',
          path: '/subscription'
        }
      ]
    },
    {
      title: 'Communication',
      modules: [
        {
          id: 'templates',
          title: 'Templates',
          icon: MessageSquare,
          iconColor: '#2D9596',
          backgroundColor: '#E0F2F2',
          path: '/admin/templates'
        },
        {
          id: 'doctors',
          title: 'Ref. Doctors',
          icon: UserPlus,
          iconColor: '#2D9596',
          backgroundColor: '#E0F2F2',
          path: '/admin/doctors'
        }
      ]
    },
    {
      title: 'System',
      modules: [
        {
          id: 'permissions',
          title: 'Permissions',
          icon: Lock,
          iconColor: '#2D9596',
          backgroundColor: '#E0F2F2',
          path: '/admin/permissions'
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Gradient - No rounded corners, with decorative dots */}
      <div className="bg-gradient-to-br from-[#29828a] to-[#1F6B72] px-6 py-8 mb-6 relative overflow-hidden">
        {/* Decorative dot pattern on right side */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-64 opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.6) 2px, transparent 2px)',
            backgroundSize: '20px 20px'
          }}
        ></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          {/* Clinic Info */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">BrightSmile Clinic</h1>
              <p className="text-white/90 text-base mb-3">📍 London, Marylebone NW1</p>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 bg-white/25 px-3 py-1.5 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <span className="text-white text-sm font-semibold">Open</span>
                </div>
                <div className="flex items-center gap-2 bg-white/25 px-3 py-1.5 rounded-xl">
                  <Users size={14} className="text-white" />
                  <span className="text-white text-sm font-semibold">12 Staff</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center">
                <Briefcase size={32} className="text-white" />
              </div>
              <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-400 border-3 border-white"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Hub Section - Organized by categories */}
      <div className="max-w-7xl mx-auto px-6 space-y-8">
        {adminSections.map((section) => (
          <div key={section.title}>
            {/* Section Header */}
            <div className="flex items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
              <div className="flex-1 ml-4 h-px bg-gray-200"></div>
            </div>

            {/* Module Cards Grid - Very small compact cards */}
            <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {section.modules.map((module) => {
                const Icon = module.icon;
                return (
                  <button
                    key={module.id}
                    onClick={() => navigate(module.path)}
                    className="group relative aspect-square rounded-lg p-2 flex flex-col items-center justify-center transition-all hover:scale-105 hover:shadow-lg"
                    style={{ backgroundColor: module.backgroundColor }}
                  >
                    <div className="w-8 h-8 rounded-md bg-white/50 flex items-center justify-center mb-1 group-hover:bg-white/70 transition-colors">
                      <Icon size={20} style={{ color: module.iconColor }} strokeWidth={2.5} />
                    </div>
                    <p className="text-[11px] font-semibold text-gray-700 text-center leading-tight">
                      {module.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminHub;

import { useState, useEffect } from 'react';
import Layout from '../../src/components/Layout';
import { useAuth } from '../../src/contexts/AuthContext';
import { dbHelpers } from '../../src/lib/supabase';
import {
  TrendingUp,
  Calendar,
  Users,
  BarChart3,
  PieChart,
  CheckCircle,
  XCircle,
  Target,
  Award
} from 'lucide-react';

export default function TeacherAnalytics() {
  const { userProfile } = useAuth();
  const [analyticsData, setAnalyticsData] = useState({
    weeklyStats: [],
    monthlyStats: [],
    studentPerformance: [],
    overallStats: {
      totalStudents: 0,
      averageAttendance: 0,
      bestDay: '',
      worstDay: '',
      totalClasses: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week'); // week, month, semester

  useEffect(() => {
    if (userProfile) {
      fetchAnalyticsData();
    }
  }, [userProfile, timeRange]);

  async function fetchAnalyticsData() {
    try {
      setLoading(true);

      // Calculate date ranges
      const today = new Date();
      let startDate, endDate = today.toISOString().split('T')[0];

      switch (timeRange) {
        case 'week':
          startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'month':
          startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'semester':
          startDate = new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        default:
          startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      // Use the new comprehensive analytics API
      const { data: analyticsResponse, error } = await dbHelpers.getClassWiseAnalytics(
        userProfile.firebase_id,
        startDate,
        endDate
      );

      if (error) {
        console.error('Error fetching analytics:', error);
        // Fallback to old method
        await fetchAnalyticsDataFallback(startDate, endDate);
        return;
      }

      if (analyticsResponse) {
        const processedData = processNewAnalyticsData(analyticsResponse);
        setAnalyticsData(processedData);
      }

    } catch (error) {
      console.error('Error fetching analytics data:', error);
      // Fallback to old method
      const today = new Date();
      const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      await fetchAnalyticsDataFallback(startDate, endDate);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAnalyticsDataFallback(startDate, endDate) {
    try {
      // Get teacher's classes and students (fallback method)
      const { data: teacherClasses } = await dbHelpers.getClassesByTeacher(userProfile.firebase_id);

      // Get students enrolled in teacher's classes
      let allStudents = [];
      if (teacherClasses) {
        for (const classItem of teacherClasses) {
          const { data: classStudents } = await dbHelpers.getClassStudents(classItem.id);
          if (classStudents) {
            allStudents = [...allStudents, ...classStudents];
          }
        }
      }

      // Get attendance data for teacher's classes only
      const { data: attendanceData } = await dbHelpers.getAllAttendance(startDate, endDate, userProfile.firebase_id);

      // Process analytics with teacher's data only
      const analytics = processAnalyticsData(allStudents || [], attendanceData || [], startDate, endDate);
      setAnalyticsData(analytics);

    } catch (error) {
      console.error('Error in fallback analytics:', error);
    }
  }

  function processNewAnalyticsData(analyticsResponse) {
    const { classes, overall_stats } = analyticsResponse;

    // Convert class analytics to weekly stats format for charts
    const weeklyStats = [];
    const studentPerformance = [];

    // Process each class for weekly view
    classes.forEach(classData => {
      classData.daily_breakdown.forEach(day => {
        const existingDay = weeklyStats.find(w => w.date === day.date);
        if (existingDay) {
          existingDay.present += day.present;
          existingDay.total += day.total;
          existingDay.attendanceRate = Math.round((existingDay.present / existingDay.total) * 100);
        } else {
          weeklyStats.push({
            date: day.date,
            present: day.present,
            total: day.total,
            attendanceRate: day.rate,
            day: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })
          });
        }
      });
    });

    // Sort weekly stats by date
    weeklyStats.sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      weeklyStats,
      monthlyStats: weeklyStats,
      studentPerformance,
      classBreakdown: classes, // New: detailed class breakdown
      overallStats: {
        totalStudents: overall_stats.total_students,
        averageAttendance: overall_stats.overall_attendance_rate,
        bestDay: overall_stats.best_performing_class?.name || 'N/A',
        worstDay: overall_stats.worst_performing_class?.name || 'N/A',
        totalClasses: overall_stats.total_classes
      }
    };
  }

  function processAnalyticsData(students, attendanceData, startDate, endDate) {
    const totalStudents = students.length;
    
    // Group attendance by date
    const attendanceByDate = {};
    const attendanceByStudent = {};

    attendanceData.forEach(record => {
      const date = record.attendance_date;
      const studentId = record.student_id;

      // By date
      if (!attendanceByDate[date]) {
        attendanceByDate[date] = { present: 0, total: 0 };
      }
      attendanceByDate[date].total++;
      if (record.status === 'present') {
        attendanceByDate[date].present++;
      }

      // By student
      if (!attendanceByStudent[studentId]) {
        attendanceByStudent[studentId] = { present: 0, total: 0, name: record.student_name || 'Unknown' };
      }
      attendanceByStudent[studentId].total++;
      if (record.status === 'present') {
        attendanceByStudent[studentId].present++;
      }
    });

    // Calculate weekly stats
    const weeklyStats = Object.entries(attendanceByDate).map(([date, stats]) => ({
      date,
      attendanceRate: totalStudents > 0 ? Math.round((stats.present / totalStudents) * 100) : 0,
      present: stats.present,
      absent: totalStudents - stats.present,
      day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate student performance
    const studentPerformance = Object.entries(attendanceByStudent).map(([studentId, stats]) => ({
      studentId,
      name: stats.name,
      attendanceRate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
      present: stats.present,
      total: stats.total,
      absent: stats.total - stats.present
    })).sort((a, b) => b.attendanceRate - a.attendanceRate);

    // Calculate overall stats
    const totalRecords = attendanceData.length;
    const totalPresent = attendanceData.filter(r => r.status === 'present').length;
    const averageAttendance = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

    // Find best and worst days
    const dayStats = weeklyStats.reduce((acc, day) => {
      if (!acc.best || day.attendanceRate > acc.best.attendanceRate) {
        acc.best = day;
      }
      if (!acc.worst || day.attendanceRate < acc.worst.attendanceRate) {
        acc.worst = day;
      }
      return acc;
    }, {});

    return {
      weeklyStats,
      monthlyStats: weeklyStats, // For now, same as weekly
      studentPerformance,
      overallStats: {
        totalStudents,
        averageAttendance,
        bestDay: dayStats.best?.day || 'N/A',
        worstDay: dayStats.worst?.day || 'N/A',
        totalClasses: Object.keys(attendanceByDate).length
      }
    };
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="loading-spinner"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2">Analytics Dashboard</h1>
                <p className="text-purple-100 text-lg">Detailed attendance insights and patterns</p>
                <div className="flex items-center space-x-4 mt-3">
                  <div className="flex items-center space-x-2">
                    <Target className="h-4 w-4 text-purple-300" />
                    <span className="text-sm">{analyticsData.overallStats.averageAttendance}% Average</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Award className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm">{analyticsData.overallStats.totalClasses} Classes</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Range Selector */}
            <div className="flex space-x-2">
              {['week', 'month', 'semester'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-xl font-medium transition-all transform hover:scale-105 ${
                    timeRange === range
                      ? 'bg-white text-purple-600 shadow-lg'
                      : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center transform hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-2">{analyticsData.overallStats.totalStudents}</div>
            <div className="text-gray-600 font-medium">Total Students</div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center transform hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-600 mb-2">{analyticsData.overallStats.averageAttendance}%</div>
            <div className="text-gray-600 font-medium">Avg Attendance</div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center transform hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-purple-600 mb-2">{analyticsData.overallStats.totalClasses}</div>
            <div className="text-gray-600 font-medium">Total Classes</div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center transform hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-600 mb-2">{analyticsData.overallStats.bestDay}</div>
            <div className="text-gray-600 font-medium">Best Day</div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center transform hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="h-6 w-6 text-red-600" />
            </div>
            <div className="text-3xl font-bold text-red-600 mb-2">{analyticsData.overallStats.worstDay}</div>
            <div className="text-gray-600 font-medium">Needs Attention</div>
          </div>
        </div>

        {/* Attendance Trends */}
        <div className="card">
          <div className="flex items-center mb-4">
            <BarChart3 className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Attendance Trends</h2>
          </div>
          
          {analyticsData.weeklyStats.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-2">
                {analyticsData.weeklyStats.map((day, index) => (
                  <div key={index} className="text-center">
                    <div className="text-sm font-medium text-gray-600 mb-2">{day.day}</div>
                    <div className="relative">
                      <div className="bg-gray-200 rounded-full h-24 w-8 mx-auto relative">
                        <div 
                          className={`absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500 ${
                            day.attendanceRate >= 80 ? 'bg-green-500' :
                            day.attendanceRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ height: `${day.attendanceRate}%` }}
                        ></div>
                      </div>
                      <div className="text-xs font-medium text-gray-900 mt-1">{day.attendanceRate}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No attendance data available for the selected period
            </div>
          )}
        </div>

        {/* Class-wise Breakdown */}
        {analyticsData.classBreakdown && analyticsData.classBreakdown.length > 0 && (
          <div className="card">
            <div className="flex items-center mb-6">
              <PieChart className="h-6 w-6 text-purple-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Class-wise Performance</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {analyticsData.classBreakdown.map((classData) => (
                <div key={classData.class_id} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 text-lg">{classData.class_name}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      classData.attendance_rate >= 80 ? 'bg-green-100 text-green-800' :
                      classData.attendance_rate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {classData.attendance_rate}%
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subject:</span>
                      <span className="font-medium text-gray-900">{classData.subject}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Enrolled Students:</span>
                      <span className="font-medium text-blue-600">{classData.enrolled_students}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Records:</span>
                      <span className="font-medium text-gray-900">{classData.total_records}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Present:</span>
                      <span className="font-medium text-green-600">{classData.present_records}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${
                          classData.attendance_rate >= 80 ? 'bg-green-500' :
                          classData.attendance_rate >= 60 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${classData.attendance_rate}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Slot-wise breakdown */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Slot Performance</h4>
                    <div className="grid grid-cols-3 gap-1">
                      {Object.entries(classData.slot_breakdown).map(([slotKey, slotData]) => {
                        const slotNumber = slotKey.replace('slot_', '');
                        return (
                          <div key={slotKey} className="text-center">
                            <div className="text-xs text-gray-600">S{slotNumber}</div>
                            <div className={`text-xs font-medium ${
                              slotData.rate >= 80 ? 'text-green-600' :
                              slotData.rate >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {slotData.rate}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Student Performance */}
        <div className="card">
          <div className="flex items-center mb-4">
            <Users className="h-6 w-6 text-green-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Student Performance</h2>
          </div>

          {analyticsData.studentPerformance.length > 0 ? (
            <div className="space-y-3">
              {analyticsData.studentPerformance.slice(0, 10).map((student, index) => (
                <div key={student.studentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3 ${
                      index < 3 ? 'bg-green-500' : index < 7 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{student.name}</div>
                      <div className="text-sm text-gray-600">{student.present}/{student.total} classes</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      student.attendanceRate >= 80 ? 'text-green-600' :
                      student.attendanceRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {student.attendanceRate}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No student performance data available
            </div>
          )}
        </div>


      </div>
    </Layout>
  );
}


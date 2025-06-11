import { useState, useEffect } from 'react';
import Layout from '../../src/components/Layout';
import { useAuth } from '../../src/contexts/AuthContext';
import { dbHelpers } from '../../src/lib/supabase';
import { Calendar, Camera, CheckCircle, XCircle, Clock, User, TrendingUp, Award, Target, Timer } from 'lucide-react';
import Link from 'next/link';

export default function StudentDashboard() {
  const { userProfile, currentUser } = useAuth();
  const [attendanceData, setAttendanceData] = useState({
    today: null,
    thisWeek: [],
    thisMonth: [],
    stats: {
      present: 0,
      absent: 0,
      total: 0,
      percentage: 0
    }
  });
  const [classWiseData, setClassWiseData] = useState([]);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile && currentUser) {
      fetchAttendanceData();
      fetchProfilePhoto();
    }
  }, [userProfile, currentUser]);

  async function fetchAttendanceData() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      console.log('🔍 Fetching attendance data for student:', currentUser.uid);
      console.log('📅 Date range:', { today, weekAgo, monthAgo });

      // Get today's attendance - Use Firebase ID (currentUser.uid) instead of database ID
      const { data: todayData, error: todayError } = await dbHelpers.getAttendanceByUser(currentUser.uid, today, today);
      console.log('📊 Today\'s attendance data:', { todayData, todayError });

      // Get this week's attendance
      const { data: weekData, error: weekError } = await dbHelpers.getAttendanceByUser(currentUser.uid, weekAgo, today);
      console.log('📊 Week\'s attendance data:', { weekData, weekError });

      // Get this month's attendance
      const { data: monthData, error: monthError } = await dbHelpers.getAttendanceByUser(currentUser.uid, monthAgo, today);
      console.log('📊 Month\'s attendance data:', { monthData, monthError });

      // Get student's classes for class-wise breakdown
      const { data: studentClasses } = await dbHelpers.getClassesByStudent(currentUser.uid);

      // Calculate class-wise attendance
      const classWiseAttendance = [];
      if (studentClasses && monthData) {
        for (const classItem of studentClasses) {
          const classAttendance = monthData.filter(record => record.class_id === classItem.id);
          const presentCount = classAttendance.filter(record => record.status === 'present').length;
          const totalCount = classAttendance.length;
          const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

          classWiseAttendance.push({
            ...classItem,
            present: presentCount,
            total: totalCount,
            attendanceRate
          });
        }
      }

      setClassWiseData(classWiseAttendance);

      // Calculate overall stats
      const presentDays = monthData?.filter(record => record.status === 'present').length || 0;
      const absentDays = monthData?.filter(record => record.status === 'absent').length || 0;
      const totalDays = monthData?.length || 0;
      const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      setAttendanceData({
        today: todayData?.[0] || null,
        thisWeek: weekData || [],
        thisMonth: monthData || [],
        stats: {
          present: presentDays,
          absent: absentDays,
          total: totalDays,
          percentage
        }
      });
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProfilePhoto() {
    try {
      const { data } = await dbHelpers.getProfilePhoto(currentUser.uid);
      if (data && data.profile_photo_url) {
        setProfilePhoto(data.profile_photo_url);
      }
    } catch (error) {
      console.error('Error fetching profile photo:', error);
    }
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
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <div className="flex items-center space-x-6">
            <div className="flex-shrink-0">
              {profilePhoto ? (
                <div className="relative">
                  <img
                    src={profilePhoto}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover border-4 border-white/30 shadow-lg"
                  />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-400 rounded-full border-2 border-white flex items-center justify-center">
                    <CheckCircle className="h-3 w-3 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center border-4 border-white/30">
                  <User className="h-10 w-10 text-white/80" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">
                Welcome back, {userProfile?.name}!
              </h1>
              <p className="text-blue-100 text-lg">Student ID: {userProfile?.student_id}</p>
              <div className="mt-4 flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Award className="h-5 w-5 text-yellow-400" />
                  <span className="text-sm">Attendance Champion</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-green-400" />
                  <span className="text-sm">{attendanceData.stats.percentage.toFixed(1)}% This Month</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Status */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Calendar className="h-6 w-6 mr-3 text-blue-600" />
            Today's Attendance
          </h2>
          {attendanceData.today ? (
            <div className="flex items-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-lg font-semibold text-green-800">Present</p>
                <p className="text-green-600">
                  Marked at {new Date(attendanceData.today.created_at || attendanceData.today.timestamp).toLocaleTimeString()}
                </p>
                <p className="text-sm text-green-500">
                  Class: {attendanceData.today.class_name} • Slot {attendanceData.today.slot_number}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">✓</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center p-6 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-lg font-semibold text-yellow-800">No Attendance Today</p>
                <p className="text-yellow-600">
                  {attendanceData.stats.total === 0
                    ? "You haven't marked any attendance yet. Start by joining classes and marking attendance!"
                    : "You haven't marked attendance today. Check if you have any classes scheduled."
                  }
                </p>
              </div>
              <div className="text-right">
                <Link href="/student/instant-attendance" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Mark Now
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center transform hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-600 mb-2">
              {attendanceData.stats.present}
            </div>
            <div className="text-gray-600 font-medium">Present Days</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center transform hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="text-3xl font-bold text-red-600 mb-2">
              {attendanceData.stats.absent}
            </div>
            <div className="text-gray-600 font-medium">Absent Days</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center transform hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {attendanceData.stats.total}
            </div>
            <div className="text-gray-600 font-medium">Total Days</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center transform hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {attendanceData.stats.percentage}%
            </div>
            <div className="text-gray-600 font-medium">Attendance Rate</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link href="/student/instant-attendance" className="group flex items-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <Timer className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-gray-900 text-lg">Quick Attendance</div>
                <div className="text-blue-600">Use teacher's code</div>
              </div>
            </Link>

            <Link href="/student/timetable" className="group flex items-center p-6 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
              <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-gray-900 text-lg">My Timetable</div>
                <div className="text-green-600">View class schedule</div>
              </div>
            </Link>

            <Link href="/student/history" className="group flex items-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
              <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-gray-900 text-lg">View History</div>
                <div className="text-orange-600">Check past attendance</div>
              </div>
            </Link>

            <Link href="/student/enroll" className="group flex items-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
              <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-gray-900 text-lg">Manage Face</div>
                <div className="text-purple-600">Enroll or view your face</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Class-wise Attendance */}
        {classWiseData.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Class-wise Attendance (This Month)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classWiseData.map((classItem) => (
                <div key={classItem.id} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 truncate">{classItem.name}</h3>
                      <p className="text-xs text-gray-600">{classItem.subject}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      classItem.attendanceRate >= 80 ? 'bg-green-100 text-green-800' :
                      classItem.attendanceRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {classItem.attendanceRate}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Present:</span>
                      <span className="font-medium text-green-600">{classItem.present}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Classes:</span>
                      <span className="font-medium text-gray-900">{classItem.total}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Teacher:</span>
                      <span className="font-medium text-blue-600">{classItem.teacher_name}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          classItem.attendanceRate >= 80 ? 'bg-green-500' :
                          classItem.attendanceRate >= 60 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${classItem.attendanceRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Attendance */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Attendance</h2>
          {attendanceData.thisWeek.length > 0 ? (
            <div className="space-y-2">
              {attendanceData.thisWeek.slice(0, 5).map((record) => (
                <div key={record.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center">
                    {record.status === 'present' ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mr-3" />
                    )}
                    <div>
                      <div className="font-medium">
                        {new Date(record.attendance_date).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {record.class_name} • Slot {record.slot_number}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {record.created_at && new Date(record.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No attendance records found.</p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>To start tracking attendance:</p>
                <p>1. Join classes using class codes from your teachers</p>
                <p>2. Mark attendance using face recognition or instant passwords</p>
                <p>3. Your attendance history will appear here</p>
              </div>
              <div className="mt-4 space-x-2">
                <Link href="/student/classes" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm">
                  Join Classes
                </Link>
                <Link href="/student/instant-attendance" className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm">
                  Mark Attendance
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}


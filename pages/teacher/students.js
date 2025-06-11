import { useState, useEffect } from 'react';
import Layout from '../../src/components/Layout';
import { useAuth } from '../../src/contexts/AuthContext';
import { dbHelpers } from '../../src/lib/supabase';
import { Users, Search, CheckCircle, XCircle, Calendar, User, Eye, X, UserCheck, Filter } from 'lucide-react';

export default function ManageStudents() {
  const { userProfile } = useAuth();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState({});
  const [profilePhotos, setProfilePhotos] = useState({});
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    if (userProfile) {
      fetchStudents();
    }
  }, [userProfile]);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm]);

  async function fetchStudents() {
    try {
      // Get students enrolled in teacher's classes
      const { data: teacherClasses } = await dbHelpers.getClassesByTeacher(userProfile.firebase_id);

      let allStudents = [];
      if (teacherClasses) {
        for (const classItem of teacherClasses) {
          const { data: classStudents } = await dbHelpers.getClassStudents(classItem.id);
          if (classStudents) {
            // Add class info to each student
            const studentsWithClass = classStudents.map(student => ({
              ...student,
              class_name: classItem.name,
              class_id: classItem.id
            }));
            allStudents = [...allStudents, ...studentsWithClass];
          }
        }
      }

      setStudents(allStudents);

      // Get today's attendance for teacher's classes
      const today = new Date().toISOString().split('T')[0];
      const { data: todayAttendance } = await dbHelpers.getAllAttendance(today, today, userProfile.firebase_id);

      // Create attendance lookup by student_id and class_id
      const attendanceLookup = {};
      todayAttendance?.forEach(record => {
        const key = `${record.student_id}_${record.class_id}`;
        attendanceLookup[key] = record;
      });

        setAttendanceData(attendanceLookup);

        // Fetch profile photos for all students
        const photoPromises = allStudents.map(async (student) => {
          try {
            const { data } = await dbHelpers.getProfilePhoto(student.firebase_id);
            return {
              id: student.id,
              photo: data?.profile_photo_url || null
            };
          } catch (error) {
            console.error(`Error fetching photo for ${student.name}:`, error);
            return { id: student.id, photo: null };
          }
        });

        const photoResults = await Promise.all(photoPromises);
        const photoLookup = {};
        photoResults.forEach(result => {
          photoLookup[result.id] = result.photo;
        });

        setProfilePhotos(photoLookup);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterStudents() {
    if (!searchTerm) {
      setFilteredStudents(students);
      return;
    }
    
    const filtered = students.filter(student =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.student_id && student.student_id.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    setFilteredStudents(filtered);
  }

  function getAttendanceStatus(studentId, classId) {
    const key = `${studentId}_${classId}`;
    const attendance = attendanceData[key];
    if (attendance) {
      return {
        status: attendance.status,
        time: new Date(attendance.created_at).toLocaleTimeString(),
        present: attendance.status === 'present'
      };
    }
    return {
      status: 'absent',
      time: null,
      present: false
    };
  }

  function openProfileModal(student) {
    setSelectedStudent(student);
    setShowProfileModal(true);
  }

  function closeProfileModal() {
    setSelectedStudent(null);
    setShowProfileModal(false);
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
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-8 text-white">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <UserCheck className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">Manage Students</h1>
              <p className="text-blue-100 text-lg">View and manage student information and attendance</p>
              <div className="flex items-center space-x-4 mt-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-cyan-300" />
                  <span className="text-sm">{students.length} Total Students</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-sm">Today's Attendance</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Filter className="h-5 w-5 text-blue-600 mr-2" />
            Search Students
          </h2>
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or student ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              Showing {filteredStudents.length} of {students.length} students
            </div>
          </div>
        </div>

        {/* Today's Attendance Summary */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Calendar className="h-6 w-6 text-green-600 mr-3" />
            Today's Attendance Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-green-600 mb-1">
                {Object.values(attendanceData).filter(a => a.status === 'present').length}
              </div>
              <div className="text-sm font-medium text-green-700">Present</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <XCircle className="h-6 w-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-red-600 mb-1">
                {students.length - Object.values(attendanceData).filter(a => a.status === 'present').length}
              </div>
              <div className="text-sm font-medium text-red-700">Absent</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {students.length > 0
                  ? Math.round((Object.values(attendanceData).filter(a => a.status === 'present').length / students.length) * 100)
                  : 0}%
              </div>
              <div className="text-sm font-medium text-blue-700">Attendance Rate</div>
            </div>
          </div>
        </div>

        {/* Students List */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Students List</h2>
          
          {filteredStudents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student & Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Today's Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.map((student) => {
                    const attendance = getAttendanceStatus(student.id, student.class_id);

                    return (
                      <tr key={`${student.id}_${student.class_id}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {profilePhotos[student.id] ? (
                                <img
                                  src={profilePhotos[student.id]}
                                  alt={student.name}
                                  className="h-10 w-10 rounded-full object-cover border border-gray-200"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <User className="h-5 w-5 text-blue-600" />
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {student.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {student.class_name} • Joined {new Date(student.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.student_id || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {student.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {attendance.present ? (
                              <>
                                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                                <span className="text-green-600 font-medium">Present</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-5 w-5 text-red-500 mr-2" />
                                <span className="text-red-600 font-medium">Absent</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {attendance.time || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <button
                            onClick={() => openProfileModal(student)}
                            className="flex items-center px-3 py-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Profile
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchTerm ? 'No students found matching your search.' : 'No students registered yet.'}
              </p>
            </div>
          )}
        </div>

        {/* Profile Modal */}
        {showProfileModal && selectedStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Student Profile</h3>
                <button
                  onClick={closeProfileModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Profile Photo */}
                <div className="text-center">
                  {profilePhotos[selectedStudent.id] ? (
                    <div>
                      <img
                        src={profilePhotos[selectedStudent.id]}
                        alt={selectedStudent.name}
                        className="w-24 h-24 rounded-full object-cover border-2 border-gray-200 mx-auto mb-2"
                      />
                      <p className="text-sm text-gray-600">Enrolled Photo</p>
                    </div>
                  ) : (
                    <div>
                      <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-2">
                        <User className="h-12 w-12 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-600">No photo enrolled</p>
                    </div>
                  )}
                </div>

                {/* Student Details */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Name</label>
                    <p className="text-gray-900">{selectedStudent.name}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Student ID</label>
                    <p className="text-gray-900">{selectedStudent.student_id || 'N/A'}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-900">{selectedStudent.email}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Class</label>
                    <p className="text-gray-900">{selectedStudent.class_name}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Joined</label>
                    <p className="text-gray-900">{new Date(selectedStudent.created_at).toLocaleDateString()}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Today's Status</label>
                    <div className="flex items-center mt-1">
                      {getAttendanceStatus(selectedStudent.id, selectedStudent.class_id).present ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                          <span className="text-green-600 font-medium">Present</span>
                          <span className="text-sm text-gray-500 ml-2">
                            at {getAttendanceStatus(selectedStudent.id, selectedStudent.class_id).time}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-500 mr-2" />
                          <span className="text-red-600 font-medium">Absent</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}


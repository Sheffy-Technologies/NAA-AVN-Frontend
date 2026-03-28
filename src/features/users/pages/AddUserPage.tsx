import { useState } from "react";
// import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { useCreateUserMutation } from "@/features/users/api";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";

export const AddUserPage = () => {
  const navigate = useNavigate();
  const [createUser, { isLoading }] = useCreateUserMutation();
  const dispatch = useAppDispatch();

  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    username: "",
    phone_number: "",
    email: "",
    password: "",
    passwordConfirm: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirm) {
      dispatch(showToast({ message: "Passwords do not match", type: "error" }));
      return;
    }

    try {
      await createUser({
        firstname: form.firstname,
        lastname: form.lastname,
        username: form.username,
        phone_number: form.phone_number,
        email: form.email,
        password: form.password,
      }).unwrap();
      dispatch(showToast({ message: "User created successfully", type: "success" }));
      navigate("/dashboard/security");
    } catch (err) {
      console.error(err);
      dispatch(showToast({ message: "Failed to create user", type: "error" }));
    }
  };

  const inputClassName =
    "w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Add User</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="firstname"
            value={form.firstname}
            onChange={handleChange}
            placeholder="First name"
            className={inputClassName}
          />
          <input
            name="lastname"
            value={form.lastname}
            onChange={handleChange}
            placeholder="Last name"
            className={inputClassName}
          />

          <input
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="Username"
            className={inputClassName}
          />

          <input
            name="phone_number"
            value={form.phone_number}
            onChange={handleChange}
            placeholder="Phone number"
            className={inputClassName}
          />

          <input
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Email"
            type="email"
            className={`md:col-span-2 ${inputClassName}`}
          />

          <input
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Password"
            type="password"
            className={inputClassName}
          />
          <input
            name="passwordConfirm"
            value={form.passwordConfirm}
            onChange={handleChange}
            placeholder="Confirm password"
            type="password"
            className={inputClassName}
          />
          <p className="text-xs text-gray-300 md:col-span-2">
            Minimum characters for password is 6
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-[#7FD5FF] text-[#00263A] rounded px-4 py-2 font-medium"
          >
            {isLoading ? "Creating..." : "Create User"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-gray-300 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

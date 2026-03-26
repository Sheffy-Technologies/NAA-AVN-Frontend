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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Add User</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div className="grid grid-cols-2 gap-4">
          <input
            name="firstname"
            value={form.firstname}
            onChange={handleChange}
            placeholder="First name"
            className="bg-[#00131A] border border-[#2B2B2B] rounded px-3 py-2 text-sm text-white"
          />
          <input
            name="lastname"
            value={form.lastname}
            onChange={handleChange}
            placeholder="Last name"
            className="bg-[#00131A] border border-[#2B2B2B] rounded px-3 py-2 text-sm text-white"
          />
        </div>

        <input
          name="username"
          value={form.username}
          onChange={handleChange}
          placeholder="Username"
          className="w-full bg-[#00131A] border border-[#2B2B2B] rounded px-3 py-2 text-sm text-white"
        />

        <input
          name="phone_number"
          value={form.phone_number}
          onChange={handleChange}
          placeholder="Phone number"
          className="w-full bg-[#00131A] border border-[#2B2B2B] rounded px-3 py-2 text-sm text-white"
        />

        <input
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Email"
          type="email"
          className="w-full bg-[#00131A] border border-[#2B2B2B] rounded px-3 py-2 text-sm text-white"
        />

        <div className="grid grid-cols-2 gap-4">
          <input
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Password"
            type="password"
            className="bg-[#00131A] border border-[#2B2B2B] rounded px-3 py-2 text-sm text-white"
          />
          <input
            name="passwordConfirm"
            value={form.passwordConfirm}
            onChange={handleChange}
            placeholder="Confirm password"
            type="password"
            className="bg-[#00131A] border border-[#2B2B2B] rounded px-3 py-2 text-sm text-white"
          />
        </div>
        <p className="text-xs text-gray-300">Minimum characters for password is 6</p>

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

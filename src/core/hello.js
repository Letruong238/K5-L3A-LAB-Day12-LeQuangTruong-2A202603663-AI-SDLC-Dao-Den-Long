// Bài thử môi trường: hàm thuần, không phụ thuộc đồ họa.
export function hello() {
  return "Dao Den Long: moi truong OK";
}

// Chạy trực tiếp bằng `npm run hello` thì in ra màn hình.
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  console.log(hello());
}

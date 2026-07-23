// Umeyama similarity fit for the 2DGS control points.
import { Matrix, SVD } from 'ml-matrix';
import { Cartesian3, Matrix4 } from 'cesium';

export interface SimilarityFit {
  matrix: Matrix4; // 4x4 mapping src (mesh-local) -> dst (ECEF)
  rmse: number; // root-mean-square residual in metres
  scale: number;
}

export function umeyama(src: Cartesian3[], dst: Cartesian3[]): SimilarityFit {
  const n = src.length;
  const X = src.map((p) => [p.x, p.y, p.z]);
  const Y = dst.map((p) => [p.x, p.y, p.z]);

  const mean = (M: number[][]) => {
    const m = [0, 0, 0];
    for (const r of M) for (let k = 0; k < 3; k++) m[k] += r[k];
    return m.map((v) => v / n);
  };
  const mx = mean(X);
  const my = mean(Y);
  const Xc = X.map((r) => r.map((v, k) => v - mx[k]));
  const Yc = Y.map((r) => r.map((v, k) => v - my[k]));

  // Covariance matrix.
  const Sigma = new Matrix(3, 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += Yc[k][i] * Xc[k][j];
      Sigma.set(i, j, s / n);
    }
  }

  const svd = new SVD(Sigma);
  const U = svd.leftSingularVectors;
  const V = svd.rightSingularVectors;
  const D = svd.diagonal; // singular values

  const det3 = (M: Matrix) =>
    M.get(0, 0) * (M.get(1, 1) * M.get(2, 2) - M.get(1, 2) * M.get(2, 1)) -
    M.get(0, 1) * (M.get(1, 0) * M.get(2, 2) - M.get(1, 2) * M.get(2, 0)) +
    M.get(0, 2) * (M.get(1, 0) * M.get(2, 1) - M.get(1, 1) * M.get(2, 0));

  // Flip reflection if needed.
  const detUV = det3(U.clone().mmul(V.transpose()));
  const S = [1, 1, detUV < 0 ? -1 : 1];

  
  const Sdiag = new Matrix([
    [S[0], 0, 0],
    [0, S[1], 0],
    [0, 0, S[2]],
  ]);
  const R = U.mmul(Sdiag).mmul(V.transpose());

  // Scale.
  let varX = 0;
  for (const r of Xc) varX += r[0] * r[0] + r[1] * r[1] + r[2] * r[2];
  varX /= n;
  const traceDS = D[0] * S[0] + D[1] * S[1] + D[2] * S[2];
  const c = traceDS / varX;

  // Translation.
  const Rmx = [
    R.get(0, 0) * mx[0] + R.get(0, 1) * mx[1] + R.get(0, 2) * mx[2],
    R.get(1, 0) * mx[0] + R.get(1, 1) * mx[1] + R.get(1, 2) * mx[2],
    R.get(2, 0) * mx[0] + R.get(2, 1) * mx[1] + R.get(2, 2) * mx[2],
  ];
  const t = [my[0] - c * Rmx[0], my[1] - c * Rmx[1], my[2] - c * Rmx[2]];

  // Cesium Matrix4 is row-major.
  const m = new Matrix4(
    c * R.get(0, 0), c * R.get(0, 1), c * R.get(0, 2), t[0],
    c * R.get(1, 0), c * R.get(1, 1), c * R.get(1, 2), t[1],
    c * R.get(2, 0), c * R.get(2, 1), c * R.get(2, 2), t[2],
    0, 0, 0, 1,
  );

  // RMSE.
  let sse = 0;
  for (let k = 0; k < n; k++) {
    const px = c * (R.get(0, 0) * X[k][0] + R.get(0, 1) * X[k][1] + R.get(0, 2) * X[k][2]) + t[0];
    const py = c * (R.get(1, 0) * X[k][0] + R.get(1, 1) * X[k][1] + R.get(1, 2) * X[k][2]) + t[1];
    const pz = c * (R.get(2, 0) * X[k][0] + R.get(2, 1) * X[k][1] + R.get(2, 2) * X[k][2]) + t[2];
    sse += (px - Y[k][0]) ** 2 + (py - Y[k][1]) ** 2 + (pz - Y[k][2]) ** 2;
  }
  return { matrix: m, rmse: Math.sqrt(sse / n), scale: c };
}

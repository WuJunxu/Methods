### Fisher Function
$j(w) = (m_1-m_2)^2/(v_1^2+v_2^2)$

m和v分别是各类的均值和标准差

[Reference](https://doi.org/10.1016/j.isprsjprs.2019.08.007)


### 巴氏距离(Bhattacharyya Distance)
满足正态分布的前提下：

$B(p,q)=\frac{1}{4}(\frac{(\mu_p-\mu_q)^2}{\sigma_p^2+\sigma_q^2})+
    \frac{1}{4}ln(
        \frac{1}{4}(
            \frac{\sigma_p^2}{\sigma_q^2}+\frac{\sigma_q^2}{\sigma_p^2}+2
            )
        )$

$\frac{1}{4}ln(
        \frac{1}{4}(
            \frac{\sigma_p^2}{\sigma_q^2}+\frac{\sigma_q^2}{\sigma_p^2}+2
            )
        )=
    \frac{1}{2}ln(
        \frac{\sigma_p^2+\sigma_q^2}{2\sigma_p\sigma_q}
        )=
    \frac{1}{2}ln(
        \frac{1}{2}(
            \frac{\sigma_p}{\sigma_q}+\frac{\sigma_q}{\sigma_p}
            )
        )$


### J-M 距离(Jeffries-Matusita Distance)

$JMD(S_1,S_2) = \sqrt{\sum_{l=1}^L[\sqrt{p_l}-\sqrt{q_l}]^2}$

if p$_l$ and q$_l$ are of normal distribution, then J-M is represented as:

$JM(S_1,S_2) = 2(1 - e^{-B})$

将Bhattacharyya Distance缩放到0~2。
[JM distance has been seen to be particularly useful for remote sensing.](https://ieeexplore.ieee.org/document/8971800). [Jeffries-Matusita distance is one of the spectral separability measures commonly used in remote sensing applications.](https://doi.org/10.1016/j.jag.2014.04.001)
